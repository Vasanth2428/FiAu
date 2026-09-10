"use client";

// AppShell — wraps every view. Sticky footer with the trust disclaimer and
// the delete-session button (spec §4.6: "Footer, always: Not therapy, not
// legal advice. FightAutopsy never determines who is right. Nothing stored
// after 24 hours. + 'Delete this session now' button").
//
// Layout invariant: min-h-screen flex flex-col, footer mt-auto. This is the
// sandbox UI rule: sticky when short, pushed when long.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();
  const code = sp.get("code") ?? undefined;
  const [deleting, setDeleting] = useState(false);

  async function deleteSession() {
    if (!code) {
      router.push("/");
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/tree?code=${code}&demo=0`, { method: "DELETE" });
    } catch {
      // best-effort; the in-memory store is gone on next boot anyway
    }
    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Quiet masthead. Small wordmark in serif, a thin rule, no nav chrome.
          The rose dot is replaced by the warm accent (terracotta) — same
          "live" signal, in the house palette. */}
      <header className="border-b border-border/70">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 self-center"
              aria-hidden
            />
            <span className="font-serif text-base sm:text-lg font-medium tracking-tight truncate">
              FightAutopsy
            </span>
            <span className="font-serif text-xs sm:text-sm text-muted-foreground italic hidden sm:inline truncate">
              a map of the fight you keep having
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
              never picks a winner
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer as colophon — quiet, generous breathing room, no chrome. */}
      <footer className="mt-auto border-t border-border/70">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Not therapy, not legal advice. FightAutopsy never determines who is
            right. Nothing is stored after 24 hours.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 shrink-0"
                disabled={!code}
                title={code ? "Delete this session now" : "No active session"}
              >
                Delete this session now
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the room and everything in it immediately. You
                  and your partner will both lose access to the map. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>
                  Keep it
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteSession}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Delete now"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </footer>
    </div>
  );
}
