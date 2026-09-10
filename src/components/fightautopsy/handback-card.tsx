"use client";

// HandbackCard (bottom) — spec §4.6.
// Opening sentence in large type, discussion order, reframe, copy button.
// Phase 1: minimal. Phase 4 polishes.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
        handback.opening,
        "",
        "Order to discuss (facts first, values last):",
        ...handback.order.map((id, i) => `${i + 1}. claim ${id}`),
        "",
        `Reframe: ${handback.reframe}`,
      ].join("\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Card className="border-0 shadow-none bg-muted/40 rounded-xl">
      <CardContent className="space-y-6 pt-8 pb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3 font-medium">
            One conversation to have
          </p>
          <p className="font-serif text-xl sm:text-2xl md:text-[1.75rem] font-normal leading-snug text-foreground">
            {handback.opening}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2.5 font-medium">
            Discuss in this order
          </p>
          <div className="flex flex-wrap gap-1.5">
            {handback.order.map((id, i) => (
              <Badge key={id} variant="outline" className="font-mono text-xs">
                {i + 1}. {id}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2.5 italic">
            Facts first, values last.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2 font-medium">
            Reframe
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {handback.reframe}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={copy} className="w-full sm:w-auto">
          {copied ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
          {copied ? "Copied" : "Copy the conversation"}
        </Button>
      </CardContent>
    </Card>
  );
}
