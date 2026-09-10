"use client";

// FightAutopsy — single-route shell.
//
// Per the locked decision: one route (`/`) with query params. The three views
// (landing, intake, tree) are self-contained components. This file is the
// thin router that maps `view` → component (~30 lines, per the user's
// architectural condition). Real routes at startup-migration time become a
// mechanical swap, not a refactor.
//
// Query params:
//   ?view=join&code=ABC123   — join a couple room (B's entry point)
//   ?view=intake&code=...&person=A|B  — guided intake
//   ?view=tree&code=...      — poll + render the issue tree
//   (none)                   — landing

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LandingView } from "@/components/fightautopsy/landing-view";
import { IntakeView } from "@/components/fightautopsy/intake-view";
import { TreeView } from "@/components/fightautopsy/tree-view";
import { AppShell } from "@/components/fightautopsy/app-shell";

function Router() {
  const sp = useSearchParams();
  const router = useRouter();
  const view = sp.get("view") ?? "landing";
  const code = sp.get("code") ?? undefined;
  const person = (sp.get("person") as "A" | "B" | null) ?? undefined;

  let body: React.ReactNode;
  if (view === "intake" && code && (person === "A" || person === "B")) {
    body = <IntakeView code={code} person={person} />;
  } else if (view === "tree" && code) {
    body = <TreeView code={code} />;
  } else if (view === "join" && code) {
    // join → intake as B
    body = <IntakeView code={code} person="B" joinMode />;
  } else {
    body = (
      <LandingView />
    );
  }
  return <AppShell>{body}</AppShell>;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <Router />
    </Suspense>
  );
}
