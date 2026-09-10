"use client";

// SidePanel — opens when a claim node is clicked.
// Spec §4.6: full quote, absolute rewrite ("You said 'he never helps' — the
// record shows the last three Sundays"), and connected alignments.
// Phase 1: minimal. Phase 4 polishes.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Analysis, Claim } from "@/lib/fightautopsy/types";
import { LAYER_STYLES, PERSON_BADGE } from "./issue-tree";
import { cn } from "@/lib/utils";

interface Props {
  analysis: Analysis;
  claimId: string;
  onClose: () => void;
}

export function SidePanel({ analysis, claimId, onClose }: Props) {
  const claim = analysis.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  // Find alignments touching this claim
  const touching = analysis.alignments.filter((a) =>
    a.claims.includes(claimId),
  );

  // For each touching alignment, find the OTHER claim
  const pairs = touching.map((a) => {
    const otherId = a.claims.find((id) => id !== claimId) ?? a.claims[0];
    const other = analysis.claims.find((c) => c.id === otherId);
    return { alignment: a, other };
  });

  const style = LAYER_STYLES[claim.layer];

  return (
    <Card className={cn("border-0 shadow-none rounded-xl bg-muted/40 overflow-hidden")}>
      {/* Layer-colored accent strip on the left edge — replaces the heavy
          border-2 (kept the spec-defined layer color visible without the
          boxy feeling). */}
      <div className={cn("h-1 w-full", style.dot)} aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <Badge className={cn("text-[10px]", PERSON_BADGE[claim.person])}>
              Person {claim.person}
            </Badge>
            <span className={cn("text-xs font-medium uppercase tracking-[0.1em]", style.text)}>
              {style.label}
            </span>
          </div>
          <CardTitle className="font-serif text-base leading-snug">
            &ldquo;{claim.quote}&rdquo;
          </CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {claim.absolutes && claim.absolutes.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2.5 font-medium">
              Absolute to rewrite
            </p>
            <ul className="space-y-2.5">
              {claim.absolutes.map((ab, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  <p>
                    You wrote <span className="font-semibold italic">&ldquo;{ab.word}&rdquo;</span>.
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    A specific rewrite: <span className="italic">&ldquo;{ab.rewrite}&rdquo;</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pairs.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2.5 font-medium">
              Connections
            </p>
            <ul className="space-y-3">
              {pairs.map(({ alignment, other }, i) => (
                <li key={i} className="text-sm border-l-2 pl-3.5" style={{
                  borderColor: alignment.type === "AGREE" ? "#059669" : alignment.type === "CONTRADICT" ? "#e11d48" : "#78716c",
                }}>
                  <p className="font-medium mb-1">
                    {alignment.type === "AGREE" && "Agrees with"}
                    {alignment.type === "CONTRADICT" && "Contradicts"}
                    {alignment.type === "DISCONNECT" && "Disconnects from"}
                    {other ? ` person ${other.person}` : ""}
                  </p>
                  {other && (
                    <p className="text-muted-foreground italic font-serif leading-relaxed">
                      &ldquo;{other.quote}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{alignment.note}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pairs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No alignments touch this claim.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
