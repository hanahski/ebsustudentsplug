import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Swords, ArrowLeft, Coins, Trophy, Shield, Zap, Hash, Grid3x3, Dices, Puzzle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/earn-credits/battle")({
  component: BattlePage,
  head: () => ({ meta: [{ title: "Battle — 1v1 for Plug Credits" }] }),
});

type Match = {
  id: string;
  status: string;
  player_a: string;
  player_b: string | null;
  stake: number;
  mode: string;
  created_at: string;
};

function BattlePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUid(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const { data } = await supabase
        .from("battle_matches")
        .select("id,status,player_a,player_b,stake,mode,created_at")
        .or(`player_a.eq.${uid},player_b.eq.${uid}`)
        .in("status", ["pending", "coin_flip", "active"])
        .order("created_at", { ascending: false })
        .limit(10);
      setMatches((data as Match[]) ?? []);
    };
    load();
    const ch = supabase
      .channel("my-battles-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_matches" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

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
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold font-display">Battle · 1v1</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Stake <span className="font-semibold text-foreground">10 PC</span>, tic-tac-toe with a coin flip
                for first move. Winner takes 20 PC. Draw refunds both.
              </p>
            </div>
          </div>
        </header>

        <Link
          to="/earn-credits/battle/scan"
          className="group block relative overflow-hidden rounded-3xl border p-6 bg-gradient-to-br from-primary/15 via-card to-card shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all"
        >
          <div className="absolute inset-0 -z-0 opacity-40 [background:radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.25),transparent_60%),radial-gradient(circle_at_80%_80%,hsl(var(--accent)/0.25),transparent_60%)]" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 text-primary-foreground flex items-center justify-center shadow-glow">
              <ScanLine className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Scan for Battle</div>
              <div className="font-bold font-display text-lg">Find a random opponent →</div>
              <div className="text-xs text-muted-foreground">Or challenge a specific player by name.</div>
            </div>
            <Coins className="w-6 h-6 text-primary opacity-70 group-hover:scale-110 transition-transform" />
          </div>
        </Link>

        {matches.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Ongoing</h2>
            <div className="space-y-2">
              {matches.map((m) => (
                <Link
                  key={m.id}
                  to="/earn-credits/battle/play/$matchId"
                  params={{ matchId: m.id }}
                  className="flex items-center justify-between bg-card border rounded-2xl p-4 hover:border-primary transition"
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {m.status === "pending" && m.player_b === uid
                        ? "⚔️ Incoming challenge"
                        : m.status === "pending"
                          ? "Waiting for opponent"
                          : m.status === "coin_flip"
                            ? "Coin flip in progress"
                            : "In game"}
                    </div>
                    <div className="text-xs text-muted-foreground">Stake: {m.stake} PC · {m.mode}</div>
                  </div>
                  <Button size="sm">Open</Button>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: "Fair matching", desc: "Random opponents, device-aware" },
            { icon: Zap, label: "Coin flip start", desc: "Heads or tails picks who moves first" },
            { icon: Trophy, label: "Winner takes 20", desc: "Draw = full refund" },
          ].map((f) => (
            <div key={f.label} className="bg-card border rounded-2xl p-3 text-center">
              <f.icon className="w-5 h-5 mx-auto text-primary mb-1" />
              <div className="text-xs font-semibold">{f.label}</div>
              <div className="text-[10px] text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
