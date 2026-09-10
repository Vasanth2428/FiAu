"use client";

// TreeView — polls /api/tree every 2s (spec §4.4).
// Renders the Narrative Scroll:
//   Act 1: Hero Proxy Headline ("This probably isn't about...")
//   Act 2: The Bridge ("Where you already agree")
//   Act 3: The Folded Map ("See the full map of where you differ")
//   Act 4: The Handback as a Closing Letter

import { useCallback, useEffect, useState } from "react";
import { IssueTree, LayerLegend } from "./issue-tree";
import { SidePanel } from "./side-panel";
import { ProxyCard } from "./proxy-card";
import { AgreementsBridge } from "./agreements-bridge";
import { HandbackCard } from "./handback-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Analysis, TreeResponse } from "@/lib/fightautopsy/types";

interface Props {
  code: string;
}

const STAGED_COPY = [
  "Reading the accounts…",
  "Lining up the two sides…",
  "Finding the layers…",
  "Checking the quotes against what was written…",
  "Writing your conversation…",
];

export function TreeView({ code }: Props) {
  const [status, setStatus] = useState<TreeResponse["status"]>("waiting");
  const [analysis, setAnalysis] = useState<Analysis | undefined>(undefined);
  const [names, setNames] = useState<{ A?: string; B?: string } | undefined>(undefined);
  const [soloConverted, setSoloConverted] = useState(false);
  const [fixtureUsed, setFixtureUsed] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | undefined>();
  const [copyIdx, setCopyIdx] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  // Poll
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/tree?code=${code}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const data: TreeResponse = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        setAnalysis(data.analysis);
        setNames(data.names);
        setSoloConverted(!!data.soloConverted);
        setFixtureUsed(!!data.fixtureUsed);
        if (data.status !== "ready") {
          timer = setTimeout(poll, 2000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 2000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [code]);

  useEffect(() => {
    if (status === "ready" || status === "error") return;
    const id = setInterval(() => {
      setCopyIdx((i) => (i + 1) % STAGED_COPY.length);
    }, 2500);
    return () => clearInterval(id);
  }, [status]);

  const reload = useCallback(() => {
    setStatus("waiting");
  }, []);

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
        <Card className="border-0 shadow-none bg-card rounded-2xl border border-border">
          <CardHeader>
            <CardTitle className="font-serif text-2xl font-normal tracking-tight leading-snug">
              This session is gone.
            </CardTitle>
            <CardDescription className="leading-relaxed pt-1.5">
              The room code <span className="font-mono">{code}</span> doesn&apos;t
              exist. It may have expired (sessions live 24 hours), been deleted,
              or never existed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href="/">Start a new session</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status !== "ready" || !analysis) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center space-y-4">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
          <p className="font-serif text-lg sm:text-xl font-normal text-foreground">{STAGED_COPY[copyIdx]}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {status === "waiting_for_B"
              ? "Waiting for your partner to finish their side."
              : "The wait is part of it — careful thinking, not instant answers."}
          </p>
          {soloConverted && (
            <p className="text-xs text-muted-foreground pt-2 leading-relaxed">
              Your partner didn&apos;t join within 15 minutes, so this is being
              mapped as a solo view.
            </p>
          )}
        </div>
      </div>
    );
  }

  const topic = analysis.proxies[0]?.surface ?? "the fight you brought";
  const agreeCount = analysis.alignments.filter((a) => a.type === "AGREE").length;
  const contradictCount = analysis.alignments.filter((a) => a.type === "CONTRADICT").length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10">
      {fixtureUsed && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-4 py-2.5 leading-relaxed">
          Demo data: showing an example analysis.
        </div>
      )}
      {soloConverted && (
        <div className="text-xs text-muted-foreground bg-muted/40 border border-border/60 rounded-xl px-4 py-2.5 leading-relaxed">
          Mapped solo: your partner didn&apos;t join within 15 minutes.
        </div>
      )}

      {/* Act 1 — The Headline */}
      <ProxyCard proxies={analysis.proxies} agreeCount={agreeCount} names={names} />

      {/* Act 2 — The Bridge */}
      <AgreementsBridge claims={analysis.claims} alignments={analysis.alignments} names={names} />

      {/* Act 3 — The Folded Map */}
      <div className="space-y-4 pt-2">
        <div className="rounded-2xl border border-border/80 bg-card p-6 text-center space-y-3 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            <span>Act 3 · Underlying Structure</span>
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-normal text-foreground">
            {contradictCount} {contradictCount === 1 ? "point" : "points"} where your perspectives diverge
          </h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            The full interactive map of statements, verbatim quotes, and layer connections is available below for deep exploration.
          </p>
          <Button
            variant="outline"
            onClick={() => setMapOpen(!mapOpen)}
            className="rounded-xl px-5 text-sm font-medium"
          >
            {mapOpen ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" /> Fold the map
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" /> See the full map of where you differ
              </>
            )}
          </Button>
        </div>

        {mapOpen && (
          <div className="space-y-4 pt-2 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
              <p className="text-xs text-muted-foreground font-medium">
                Click any statement box to inspect verbatim quotes and rewrites.
              </p>
              <LayerLegend />
            </div>

            <IssueTree
              analysis={analysis}
              topic={topic}
              selectedClaimId={selectedClaimId}
              onSelectClaim={setSelectedClaimId}
              names={names}
            />

            {selectedClaimId && (
              <SidePanel
                analysis={analysis}
                claimId={selectedClaimId}
                onClose={() => setSelectedClaimId(undefined)}
                names={names}
              />
            )}
          </div>
        )}
      </div>

      {/* Act 4 — The Handback as a Closing Letter */}
      <HandbackCard handback={analysis.handback} />

      <div className="text-center pt-4">
        <Button variant="ghost" size="sm" onClick={reload} className="text-xs text-muted-foreground">
          Re-check session
        </Button>
      </div>
    </div>
  );
}
