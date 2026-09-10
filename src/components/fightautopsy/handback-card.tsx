"use client";

// Act 4 — The Handback, styled as a closing letter (spec §4.6 & narrative brief).
// Generous whitespace, warm serif type, largest opening sentence on the site.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy } from "lucide-react";
import type { Handback } from "@/lib/fightautopsy/types";

interface Props {
  handback: Handback;
}

export function HandbackCard({ handback }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const text = [
        "A Letter to Open Your Conversation:",
        "",
        `"${handback.opening}"`,
        "",
        "The Shared Reframe:",
        handback.reframe,
        "",
        "Order to Walk Through (Facts First, Values Last):",
        ...handback.order.map((id, i) => `${i + 1}. Point ${id}`),
      ].join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="rounded-3xl border border-border/80 bg-card p-8 sm:p-12 md:p-14 space-y-10 shadow-sm my-8">
      {/* Letter Eyebrow */}
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <span className="text-xs uppercase tracking-[0.2em] font-semibold text-primary">
          Act 4 · Your Closing Letter
        </span>
        <span className="text-xs text-muted-foreground font-serif italic">
          To read aloud together
        </span>
      </div>

      {/* The Opening Statement — Largest type on the entire site */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          The Opening Line
        </p>
        <blockquote className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-normal leading-[1.16] text-foreground tracking-tight max-w-4xl">
          &ldquo;{handback.opening}&rdquo;
        </blockquote>
      </div>

      {/* The Reframe */}
      <div className="space-y-2.5 pt-2 max-w-3xl">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
          The Shared Reframe
        </p>
        <p className="text-base sm:text-lg text-foreground/90 font-serif leading-relaxed">
          {handback.reframe}
        </p>
      </div>

      {/* Suggested Order */}
      <div className="space-y-4 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            Recommended Discussion Steps
          </p>
          <span className="text-xs text-muted-foreground italic">Facts first · Values last</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {handback.order.map((id, i) => (
            <Badge
              key={id}
              variant="secondary"
              className="px-3 py-1 text-xs font-mono font-medium rounded-lg border border-border"
            >
              Step {i + 1}: Point {id}
            </Badge>
          ))}
        </div>
      </div>

      {/* Copy Button */}
      <div className="pt-2">
        <Button variant="outline" size="lg" onClick={copy} className="rounded-xl px-6">
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? "Copied letter to clipboard" : "Copy letter & action steps"}
        </Button>
      </div>
    </div>
  );
}
