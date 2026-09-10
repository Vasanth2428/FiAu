"use client";

// SidePanel — opens when a claim node is clicked.
// Verbatim quote provenance, absolute rewrites, and alignment connections.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Analysis } from "@/lib/fightautopsy/types";
import { PLAIN_ENGLISH_LAYERS, getPersonName } from "@/lib/fightautopsy/types";
import { PERSON_BADGE } from "./issue-tree";
import { cn } from "@/lib/utils";

interface Props {
  analysis: Analysis;
  claimId: string;
  onClose: () => void;
  names?: { A?: string; B?: string };
}

export function SidePanel({ analysis, claimId, onClose, names }: Props) {
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

  const personName = getPersonName(claim.person, names);

  return (
    <Card className={cn("border border-border/80 shadow-md rounded-2xl bg-card overflow-hidden my-4")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-[10px]", PERSON_BADGE[claim.person])}>
              {personName}
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">
              {PLAIN_ENGLISH_LAYERS[claim.layer]}
            </span>
          </div>
          <CardTitle className="font-serif text-lg leading-snug font-normal italic pt-1 text-foreground">
            &ldquo;{claim.quote}&rdquo;
          </CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 pt-2">
        {claim.absolutes && claim.absolutes.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-amber-900 dark:text-amber-300 font-semibold">
              Absolute to rewrite
            </p>
            <ul className="space-y-2">
              {claim.absolutes.map((ab, i) => (
                <li key={i} className="text-xs sm:text-sm leading-relaxed text-foreground/90">
                  <p>
                    You wrote <span className="font-semibold italic">&ldquo;{ab.word}&rdquo;</span>.
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    A specific rewrite: <span className="italic font-serif text-foreground">&ldquo;{ab.rewrite}&rdquo;</span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pairs.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold">
              Connections
            </p>
            <ul className="space-y-3">
              {pairs.map(({ alignment, other }, i) => {
                const otherName = other ? getPersonName(other.person, names) : "";
                const borderColor =
                  alignment.type === "AGREE"
                    ? "#52795a"
                    : alignment.type === "CONTRADICT"
                    ? "#b56c67"
                    : "#78716c";
                return (
                  <li
                    key={i}
                    className="text-xs sm:text-sm border-l-2 pl-3.5 py-0.5 space-y-1"
                    style={{ borderColor }}
                  >
                    <p className="font-medium text-foreground">
                      {alignment.type === "AGREE" && "Agrees with"}
                      {alignment.type === "CONTRADICT" && "Differs from"}
                      {alignment.type === "DISCONNECT" && "Unlinked from"}
                      {other ? ` ${otherName}` : ""}
                    </p>
                    {other && (
                      <p className="text-muted-foreground italic font-serif leading-relaxed">
                        &ldquo;{other.quote}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">{alignment.note}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {pairs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No alignments touch this statement.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
