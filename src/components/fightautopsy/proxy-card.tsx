"use client";

// ProxyCard (hero, top) — spec §4.6.
// "This probably isn't about the dishes." + evidence chips.
// Phase 1: minimal. Phase 4 polishes.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Proxy } from "@/lib/fightautopsy/types";
import { LAYER_STYLES } from "./issue-tree";

interface Props {
  proxies: Proxy[];
}

export function ProxyCard({ proxies }: Props) {
  if (proxies.length === 0) {
    return (
      <Card className="bg-muted/40 border-0 shadow-none rounded-xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg font-normal tracking-tight">
            No proxy pattern surfaced
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The analysis didn&apos;t find a fight-within-the-fight. That&apos;s
            honest — not every recurring fight has a hidden root, and this tool
            doesn&apos;t invent one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {proxies.map((p, i) => {
        const style = LAYER_STYLES[p.root.layer];
        return (
          <Card key={i} className="border-0 shadow-none bg-amber-50/50 rounded-xl">
            <CardHeader>
              <CardTitle className="font-serif text-lg sm:text-xl font-normal tracking-tight leading-snug">
                <span className="text-amber-700">This probably isn&apos;t about</span>{" "}
                <span className="italic">{p.surface}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">
                The fight on the surface — <span className="italic">{p.surface}</span> —
                may be standing in for something underneath. Person {p.root.person}&apos;s
                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
                  {style.label}
                </span>
                :
              </p>
              <blockquote className="border-l-2 border-amber-400 pl-4 text-sm italic text-foreground/80 font-serif leading-relaxed">
                &ldquo;{p.root.text}&rdquo;
              </blockquote>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground mr-1">Evidence:</span>
                {p.evidence.map((id) => (
                  <Badge key={id} variant="outline" className="font-mono text-xs">
                    {id}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
