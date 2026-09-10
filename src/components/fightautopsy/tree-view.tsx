"use client";

// TreeView — polls /api/tree every 2s (spec §4.4). Shows staged progress copy
// while waiting. When ready, renders the IssueTree + SidePanel + ProxyCard +
// HandbackCard.
//
// Phase 1: minimal versions of ProxyCard / HandbackCard / SidePanel — enough
// to prove the loop. Phase 4 polishes them.

import { useCallback, useEffect, useState } from "react";
import { IssueTree, LayerLegend } from "./issue-tree";
import { SidePanel } from "./side-panel";
import { ProxyCard } from "./proxy-card";
import { HandbackCard } from "./handback-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [soloConverted, setSoloConverted] = useState(false);
  const [fixtureUsed, setFixtureUsed] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | undefined>();
  const [copyIdx, setCopyIdx] = useState(0);
  const [notFound, setNotFound] = useState(false);

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

  // Staged copy rotation while waiting/analyzing. We derive the starting
  // index from status changes via a ref to avoid calling setState in the
  // effect body (which the linter correctly flags as cascading renders).
  useEffect(() => {
    if (status === "ready" || status === "error") return;
    const id = setInterval(() => {
      setCopyIdx((i) => (i + 1) % STAGED_COPY.length);
    }, 2500);
    return () => clearInterval(id);
  }, [status]);

  const reload = useCallback(() => {
    // force re-poll by toggling status
    setStatus("waiting");
  }, []);

  if (notFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24">
        <Card className="border-0 shadow-none bg-muted/50 rounded-xl">
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
        <div className="text-center">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin mb-5" />
          <p className="font-serif text-lg sm:text-xl font-normal text-foreground">{STAGED_COPY[copyIdx]}</p>
          <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">
            {status === "waiting_for_B"
              ? "Waiting for your partner to finish their side."
              : "The wait is part of it — careful thinking, not instant answers."}
          </p>
          {soloConverted && (
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Your partner didn&apos;t join within 15 minutes, so this is being
              mapped as a solo view.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Find the topic for the root node. Heuristic: use the proxy surface if any,
  // else "the fight you brought".
  const topic = analysis.proxies[0]?.surface ?? "the fight you brought";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-5">
      {fixtureUsed && (
        <div className="text-xs text-muted-foreground bg-muted/40 border-0 rounded-lg px-3.5 py-2.5 leading-relaxed">
          Demo data: showing a hand-built example analysis. (Live pipeline not
          engaged — add <span className="font-mono">demo=0</span> or remove the
          demo flag to use real analysis.)
        </div>
      )}
      {soloConverted && (
        <div className="text-xs text-muted-foreground bg-muted/40 border-0 rounded-lg px-3.5 py-2.5 leading-relaxed">
          Mapped solo: your partner didn&apos;t join within 15 minutes.
        </div>
      )}

      <ProxyCard proxies={analysis.proxies} />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 pt-2">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-normal tracking-tight leading-snug">
            Where the two sides diverge
          </h2>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            Click any claim to see the full quote and its connections.
          </p>
        </div>
        <LayerLegend />
      </div>

      <IssueTree
        analysis={analysis}
        topic={topic}
        selectedClaimId={selectedClaimId}
        onSelectClaim={setSelectedClaimId}
      />

      {selectedClaimId && (
        <SidePanel
          analysis={analysis}
          claimId={selectedClaimId}
          onClose={() => setSelectedClaimId(undefined)}
        />
      )}

      <HandbackCard handback={analysis.handback} />

      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={reload}>
          Re-check
        </Button>
      </div>
    </div>
  );
}
