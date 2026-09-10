"use client";

// Act 1 — The headline (spec §4.6 & narrative brief).
// The proxy sentence, alone, in large calm type with one terracotta accent.
// If no proxy: the agreement headline instead.

import type { Proxy } from "@/lib/fightautopsy/types";
import { getPersonName } from "@/lib/fightautopsy/types";

interface Props {
  proxies: Proxy[];
  agreeCount?: number;
  names?: { A?: string; B?: string };
}

export function ProxyCard({ proxies, agreeCount = 0, names }: Props) {
  if (proxies.length === 0) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-12 text-center space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Shared Ground
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-foreground leading-tight tracking-tight">
          You agree on more than this fight suggests — {agreeCount} shared facts.
        </h1>
        <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed pt-1">
          No hidden proxy pattern was surfaced. You are dealing with a direct, real issue with clear points of shared agreement below.
        </p>
      </div>
    );
  }

  const p = proxies[0];
  const personName = getPersonName(p.root.person, names);

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-12 text-center space-y-4">
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
        Act 1 · The Core Insight
      </p>
      <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-foreground leading-tight tracking-tight max-w-3xl mx-auto">
        This probably isn&apos;t about <span className="italic underline decoration-primary/40 underline-offset-6">{p.surface}</span>.
      </h1>
      <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed pt-1">
        The fight on the surface is standing in for a deeper need. {personName}&apos;s underlying words:
      </p>
      <blockquote className="font-serif italic text-base sm:text-lg text-foreground/90 max-w-lg mx-auto border-l-2 border-primary/50 pl-4 py-1 text-left my-4">
        &ldquo;{p.root.text}&rdquo;
      </blockquote>
    </div>
  );
}
