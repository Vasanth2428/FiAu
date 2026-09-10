"use client";

// Act 2 — The Bridge ("Where you already agree")
// The sage-green ground: one calm section displaying shared facts before anything hard.

import type { Alignment, Claim } from "@/lib/fightautopsy/types";
import { getPersonName } from "@/lib/fightautopsy/types";

interface Props {
  claims: Claim[];
  alignments: Alignment[];
  names?: { A?: string; B?: string };
}

export function AgreementsBridge({ claims, alignments, names }: Props) {
  const agreeAlignments = alignments.filter((a) => a.type === "AGREE");

  if (agreeAlignments.length === 0) {
    return null; // If no explicit agree alignment, skip or show calm default
  }

  const nameA = getPersonName("A", names);
  const nameB = getPersonName("B", names);

  return (
    <div className="rounded-2xl bg-[#f2f6f3] dark:bg-[#1a261c] border border-[#d2e0d5] dark:border-[#2d4231] p-6 sm:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#52795a]" aria-hidden />
        <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#3d5a43] dark:text-[#8cb894]">
          Act 2 · Where you already agree
        </p>
      </div>

      <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#1f2e22] dark:text-[#e4efe6] tracking-tight">
        You see {agreeAlignments.length} key {agreeAlignments.length === 1 ? "fact" : "facts"} the exact same way.
      </h2>

      <p className="text-sm sm:text-base text-[#3d5a43]/90 dark:text-[#a5c4ab] leading-relaxed max-w-2xl">
        Before walking into the hard conversations, start here. You and your partner are not operating in two different realities.
      </p>

      <div className="grid gap-3 pt-2">
        {agreeAlignments.map((a, i) => {
          const claim1 = claims.find((c) => c.id === a.claims[0]);
          const claim2 = claims.find((c) => c.id === a.claims[1]);
          return (
            <div
              key={i}
              className="rounded-xl bg-white/70 dark:bg-black/20 p-4 border border-[#d2e0d5]/60 dark:border-[#2d4231]/60 space-y-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between text-xs font-medium text-[#3d5a43] dark:text-[#8cb894] gap-1">
                <span>Shared Ground #{i + 1}</span>
                {a.note && <span className="italic font-normal">{a.note}</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {claim1 && (
                  <div className="border-l-2 border-[#6e8b74] pl-3 space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3d5a43] dark:text-[#8cb894]">
                      {getPersonName(claim1.person, names)}
                    </span>
                    <p className="font-serif italic text-[#1f2e22] dark:text-[#e4efe6] text-xs sm:text-sm">
                      &ldquo;{claim1.quote}&rdquo;
                    </p>
                  </div>
                )}
                {claim2 && (
                  <div className="border-l-2 border-[#6e8b74] pl-3 space-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3d5a43] dark:text-[#8cb894]">
                      {getPersonName(claim2.person, names)}
                    </span>
                    <p className="font-serif italic text-[#1f2e22] dark:text-[#e4efe6] text-xs sm:text-sm">
                      &ldquo;{claim2.quote}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
