import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy, Swords, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/earn-credits/battle")({
  component: BattlePage,
  head: () => ({ meta: [{ title: "Battle — Earn Plug Credits" }] }),
});

function BattlePage() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Earn Credits
        </Link>

        <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-red-500/15 via-card to-card p-6 shadow-card">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-red-500/25 blur-3xl" aria-hidden />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white flex items-center justify-center shadow-glow">
              <Swords className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Battle</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Head-to-head duels for Plug Credits — winner takes the pot.
              </p>
            </div>
          </div>
        </header>

        <div className="bg-card border rounded-2xl p-6 text-center space-y-3">
          <Trophy className="w-10 h-10 mx-auto text-primary" />
          <h2 className="font-bold font-display">Coming soon</h2>
          <p className="text-sm text-muted-foreground">
            We're wiring up 1-v-1 quiz battles, speed puzzles and word duels. In the meantime, keep
            earning with tasks and watch-and-earn.
          </p>
          <div className="flex justify-center gap-2 flex-wrap pt-1">
            <Button asChild size="sm">
              <Link to="/earn-credits">Back to Earn</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/games">Play a game</Link>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
