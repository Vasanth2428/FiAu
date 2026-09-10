"use client";

// LandingView — entry point. Two paths: solo (map your own side) or couple
// (both write separately via room-code link). Also: join an existing couple
// room by entering its code.
//
// Spec §1: "Two input modes, one engine: Solo — map your own side; Couple —
// both write separately via room-code link; neither sees the other's raw
// words, only the map."

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Room rate-limit (Voice Intake amendment invariant 4): 1 new room per hour
// per browser, advisory-level via localStorage. Prevents the new-room venting
// loop. Joining an existing room is NOT rate-limited.
const RATE_LIMIT_KEY = "fightautopsy:lastRoomAt";
const RATE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

function getRateLimitStatus(): { limited: boolean; msRemaining: number } {
  try {
    const last = localStorage.getItem(RATE_LIMIT_KEY);
    if (!last) return { limited: false, msRemaining: 0 };
    const lastAt = parseInt(last, 10);
    if (isNaN(lastAt)) return { limited: false, msRemaining: 0 };
    const elapsed = Date.now() - lastAt;
    if (elapsed < RATE_LIMIT_MS) {
      return { limited: true, msRemaining: RATE_LIMIT_MS - elapsed };
    }
    return { limited: false, msRemaining: 0 };
  } catch {
    return { limited: false, msRemaining: 0 };
  }
}

function formatRemaining(ms: number): string {
  const min = Math.ceil(ms / 60000);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"}`;
  const hr = Math.floor(min / 60);
  const rem = min % 60;
  return rem > 0 ? `${hr} hour${hr === 1 ? "" : "s"} ${rem} minute${rem === 1 ? "" : "s"}` : `${hr} hour${hr === 1 ? "" : "s"}`;
}

interface Props {
  onStartSolo: () => void;
  onStartCouple: (code: string) => void;
  onJoin: (code: string) => void;
}

export function LandingView({ onStartSolo, onStartCouple, onJoin }: Props) {
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0);

  // Check rate-limit on mount.
  function checkRateLimit() {
    const status = getRateLimitStatus();
    setRateLimited(status.limited);
    setRateLimitRemaining(status.msRemaining);
  }
  useEffect(() => {
    checkRateLimit();
  }, []);

  async function startSolo() {
    setError(null);
    const status = getRateLimitStatus();
    if (status.limited) {
      setRateLimited(true);
      setRateLimitRemaining(status.msRemaining);
      setError(`You've started a session recently. You can start another in ${formatRemaining(status.msRemaining)}. Joining an existing room is always available.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "solo" }),
      });
      if (!res.ok) throw new Error("failed to create session");
      const { code } = await res.json();
      try {
        localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      } catch {
        // ignore — advisory limit, localStorage may be blocked
      }
      onStartSolo();
      window.location.href = `/?view=intake&code=${code}&person=A`;
    } catch {
      setError("Could not start a solo session. Try again.");
      setCreating(false);
    }
  }

  async function startCouple() {
    setError(null);
    const status = getRateLimitStatus();
    if (status.limited) {
      setRateLimited(true);
      setRateLimitRemaining(status.msRemaining);
      setError(`You've started a session recently. You can start another in ${formatRemaining(status.msRemaining)}. Joining an existing room is always available.`);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "couple" }),
      });
      if (!res.ok) throw new Error("failed to create session");
      const { code } = await res.json();
      try {
        localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));
      } catch {
        // ignore
      }
      onStartCouple(code);
      window.location.href = `/?view=intake&code=${code}&person=A`;
    } catch {
      setError("Could not start a couple session. Try again.");
      setCreating(false);
    }
  }

  function submitJoin(e: React.FormEvent) {
    e.preventDefault();
    const c = joinCode.trim().toUpperCase();
    if (c.length !== 6) {
      setError("Room codes are 6 characters.");
      return;
    }
    setError(null);
    onJoin(c);
    window.location.href = `/?view=join&code=${c}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 sm:py-20 md:py-24">
      {/* Hero — editorial. Serif headline opens like an essay, not a SaaS
          hero. The kicker ("For the fight you've had forty times.") reads as
          a standfirst, italic serif. */}
      <div className="mb-12 sm:mb-16 md:mb-20 max-w-3xl">
        <p className="font-serif text-sm sm:text-base italic text-muted-foreground mb-5 sm:mb-6">
          For the fight you&apos;ve had forty times.
        </p>
        <h1 className="font-serif text-[1.875rem] sm:text-[2.5rem] md:text-[3rem] font-normal tracking-tight leading-[1.15] text-foreground">
          Each person writes their side separately. FightAutopsy maps where you
          actually diverge — what&apos;s fact, what&apos;s feeling, and what{" "}
          <span className="italic">fair</span> means to each of you.
        </h1>
        <p className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          It hands you back one conversation to have. It never picks a winner.
        </p>
      </div>

      {/* Two path cards. Lose the default shadcn border treatment — use
          soft warm washes instead of hard borders. Typography-driven, not
          component-driven. */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6 sm:mb-8">
        <Card className="border-0 shadow-none bg-muted/60 rounded-xl">
          <CardHeader>
            <CardTitle className="font-serif text-xl sm:text-2xl font-normal tracking-tight">
              Solo
            </CardTitle>
            <CardDescription className="leading-relaxed pt-1">
              Map your own side. See the layers in your own position — the
              facts you stated, the values you named, the absolutes you reached
              for.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={startSolo}
              disabled={creating}
              className="w-full"
            >
              {creating ? "Starting…" : "Map my side alone"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-none bg-muted/60 rounded-xl">
          <CardHeader>
            <CardTitle className="font-serif text-xl sm:text-2xl font-normal tracking-tight">
              Couple
            </CardTitle>
            <CardDescription className="leading-relaxed pt-1">
              You both write separately via a room-code link. Neither of you
              sees the other&apos;s raw words — only the map where they align
              and diverge.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={startCouple}
              disabled={creating}
              variant="default"
              className="w-full"
            >
              {creating ? "Starting…" : "Start a couple session"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Join existing room — quieter treatment. A subtle wash, smaller
          type, feels like a footnote rather than a third pricing tier. */}
      <Card className="bg-muted/30 border-0 shadow-none rounded-xl">
        <CardHeader>
          <CardTitle className="font-serif text-base sm:text-lg font-normal tracking-tight">
            Have a room code?
          </CardTitle>
          <CardDescription>
            If your partner started a couple session, enter the 6-character code
            they gave you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitJoin} className="flex gap-2 max-w-sm">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7PX2M"
              maxLength={6}
              className="font-mono uppercase"
              aria-label="Room code"
            />
            <Button type="submit" variant="secondary">
              Join
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Three-column footer block — feels like the explanatory deck at
          the end of an editorial, not a feature grid. Serif labels. */}
      <div className="mt-16 sm:mt-20 md:mt-24 grid sm:grid-cols-3 gap-6 sm:gap-8 text-sm text-muted-foreground">
        <div>
          <p className="font-serif font-medium text-foreground mb-1.5">No accounts</p>
          <p className="leading-relaxed">Nothing persists beyond 24 hours. You can delete a session at any time.</p>
        </div>
        <div>
          <p className="font-serif font-medium text-foreground mb-1.5">Provenance, not verdicts</p>
          <p className="leading-relaxed">Every claim on the map traces to a verbatim quote from what someone wrote.</p>
        </div>
        <div>
          <p className="font-serif font-medium text-foreground mb-1.5">Not therapy</p>
          <p className="leading-relaxed">Not legal advice either. A structured way to see a fight you can&apos;t see mid-fight.</p>
        </div>
      </div>
    </div>
  );
}
