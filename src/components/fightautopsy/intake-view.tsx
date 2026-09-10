"use client";

// IntakeView — four prompts, one per screen. localStorage draft autosave.
// 20–1500 chars per answer (spec §4.6). On couple submit: "Your answers are
// sealed. Your partner will never see your raw words — only the map."
//
// Crisis interstitial (spec §4.7): if the safety layer blocks, we show the
// calm interstitial with crisis resources and do NOT submit.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HoldToTalk } from "./hold-to-talk";
import { Input } from "@/components/ui/input";
import { CRISIS_INTERSTITIAL, type SafetyResult } from "@/lib/fightautopsy/safety";

interface Props {
  code: string;
  person: "A" | "B";
  joinMode?: boolean;
}

const STEPS = [
  {
    key: "whatHappened" as const,
    title: "What happened?",
    prompt: "Just the facts, as you remember them. What was said, what was done. Skip the interpretation for now — we'll get there.",
    placeholder: "e.g. Sunday night I came home and the dishes from breakfast were still in the sink…",
    min: 20,
    max: 1500,
  },
  {
    key: "whatIFelt" as const,
    title: "What did you feel?",
    prompt: "Name the feelings, not the story. Angry, dismissed, invisible, tired, cornered. Whatever was actually there.",
    placeholder: "e.g. I felt dismissed. I felt angry that this keeps happening…",
    min: 20,
    max: 1500,
  },
  {
    key: "whatIMadeItMean" as const,
    title: "What did you make it mean?",
    prompt: "The story your feelings told you. 'I made it mean that he doesn't respect me.' 'I made it mean nothing I do is enough.' Be honest — this is the layer fights actually live in.",
    placeholder: "e.g. I made it mean that my requests don't matter, that I have to do everything myself…",
    min: 20,
    max: 1500,
  },
  {
    key: "whatIWant" as const,
    title: "What do you want?",
    prompt: "A specific request, not an ultimatum. 'I want the dishes done during the week without me asking again.' Not 'I want you to care more.'",
    placeholder: "e.g. I want to feel like asking once is enough. I want to stop being the one who keeps the kitchen running…",
    min: 20,
    max: 1500,
  },
];

const DRAFT_KEY = (code: string, person: string) =>
  `fightautopsy:draft:${code}:${person}`;

export function IntakeView({ code, person, joinMode }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY(code, person));
      if (raw) {
        return { whatHappened: "", whatIFelt: "", whatIMadeItMean: "", whatIWant: "", ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return {
      whatHappened: "",
      whatIFelt: "",
      whatIMadeItMean: "",
      whatIWant: "",
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyBlock, setSafetyBlock] = useState<SafetyResult | null>(null);
  const [sealed, setSealed] = useState(false);

  // Autosave draft on change.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY(code, person), JSON.stringify(answers));
    } catch {
      // ignore
    }
  }, [answers, code, person]);

  const current = STEPS[step];
  const value = answers[current.key];
  const tooShort = value.trim().length < current.min;
  const tooLong = value.length > current.max;
  const isLast = step === STEPS.length - 1;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, person, answers }),
      });
      const data = await res.json();
      if (res.status === 422 && data?.safety?.blocked) {
        setSafetyBlock(data.safety);
        setSubmitting(false);
        return;
      }
      if (res.status === 409) {
        setError("This session already has an analysis and is now read-only.");
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        throw new Error(data?.error || "submission failed");
      }
      // Clear draft.
      try {
        localStorage.removeItem(DRAFT_KEY(code, person));
      } catch {
        // ignore
      }
      setSealed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submission failed");
      setSubmitting(false);
    }
  }

  if (safetyBlock) {
    return <CrisisInterstitial />;
  }

  if (sealed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
        <Card className="border-0 shadow-none bg-muted/50 rounded-xl">
          <CardHeader>
            <CardTitle className="font-serif text-2xl sm:text-3xl font-normal tracking-tight leading-snug">
              Your answers are sealed.
            </CardTitle>
            <CardDescription className="leading-relaxed pt-1.5">
              {person === "A" && !joinMode
                ? "Your partner will never see your raw words — only the map."
                : "Your partner will never see your raw words — only the map."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {person === "B"
                ? "Both sides are in. The map is being drawn now."
                : "When your partner finishes their side, the map will render here."}
            </p>
            <Button
              className="w-full"
              onClick={() => router.push(`?view=tree&code=${code}`)}
            >
              See the map
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <div className="mb-8 sm:mb-10">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>
            {joinMode ? "Joining as partner B" : `Your side (${person})`} · Step{" "}
            {step + 1} of {STEPS.length}
          </span>
          <span>
            Room <span className="font-mono">{code}</span>
          </span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1" />
      </div>

      <div className="mb-8 sm:mb-10">
        {step === 0 && (
          <div className="mb-6 space-y-1.5 p-4 rounded-xl bg-muted/30 border border-border/40">
            <label htmlFor="first-name" className="text-xs text-muted-foreground font-medium block">
              Your first name (optional)
            </label>
            <Input
              id="first-name"
              type="text"
              value={answers.name || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Alex"
              className="max-w-xs text-sm bg-background"
            />
          </div>
        )}
        <h2 className="font-serif text-2xl sm:text-3xl md:text-[2rem] font-normal tracking-tight leading-[1.2] mb-3 text-foreground">
          {current.title}
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-xl">
          {current.prompt}
        </p>
      </div>

      <Textarea
        value={value}
        onChange={(e) =>
          setAnswers((prev) => ({ ...prev, [current.key]: e.target.value }))
        }
        placeholder={current.placeholder}
        maxLength={current.max + 200}
        className="min-h-[200px] resize-y text-base leading-relaxed"
        aria-label={current.title}
      />
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className={tooShort ? "text-muted-foreground" : "text-muted-foreground/60"}>
          {value.trim().length} / {current.min} min
        </span>
        <span className={tooLong ? "text-destructive" : "text-muted-foreground/60"}>
          {value.length} / {current.max}
        </span>
      </div>

      {/* Voice intake (spec amendment §3-5). Textarea is always primary;
          mic is an alternative capture instrument. One recording + one
          re-record per prompt; mic dies after take 2. No audio persistence.
          Wrapped in a soft warm wash so the instrument feels integrated into
          the page, not bolted on below the textarea. */}
      <div className="mt-8 px-4 py-5 rounded-xl bg-muted/40">
        <HoldToTalk
          currentValue={value}
          onTranscript={(text) =>
            setAnswers((prev) => ({ ...prev, [current.key]: text }))
          }
        />
        {value && (
          <p className="mt-4 text-xs text-muted-foreground text-center italic leading-relaxed">
            This is your private draft. Edit anything before sealing — the map
            only uses what you keep.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            onClick={submit}
            disabled={submitting || tooShort || tooLong}
          >
            {submitting ? "Sealing…" : "Seal my answers"}
          </Button>
        ) : (
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={tooShort || tooLong}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

function CrisisInterstitial() {
  const c = CRISIS_INTERSTITIAL;
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <Card className="border-rose-200 bg-rose-50/50">
        <CardHeader>
          <CardTitle className="text-rose-900">{c.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-rose-900/80 whitespace-pre-line leading-relaxed">
            {c.body}
          </p>
          <ul className="space-y-2">
            {c.resources.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-rose-900 underline underline-offset-2 hover:text-rose-700"
                >
                  {r.label} →
                </a>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
