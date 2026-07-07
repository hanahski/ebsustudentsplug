import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Swords, ArrowLeft, Coins, Trophy, Shield, Zap, Hash, Grid3x3, Dices, Puzzle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/earn-credits/battle/")({
  component: BattleGamesPage,
  head: () => ({ meta: [{ title: "Battle Games — StudentsPlug" }] }),
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

const GAMES = [
  { key: "ttt", label: "Tic-Tac-Toe", desc: "Classic 3-in-a-row · 10 PC", icon: Hash, tone: "from-red-500 to-orange-600", live: true },
  { key: "connect4", label: "Connect Four", desc: "Coming soon", icon: Grid3x3, tone: "from-blue-500 to-indigo-600", live: false },
  { key: "dice", label: "Dice Duel", desc: "Coming soon", icon: Dices, tone: "from-emerald-500 to-teal-600", live: false },
  { key: "puzzle", label: "Speed Puzzle", desc: "Coming soon", icon: Puzzle, tone: "from-fuchsia-500 to-pink-600", live: false },
];

function BattleGamesPage() {
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
              <h1 className="text-2xl font-bold font-display">Battle Games</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Pick a battle game first. Tic-Tac-Toe opens scan, random matching, coin flip, then the board.
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Choose a game</h2>
            <span className="text-[10px] text-muted-foreground">More coming soon</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GAMES.map((g) => {
              const inner = (
                <>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.tone} text-white flex items-center justify-center shadow mb-3`}>
                    <g.icon className="w-6 h-6" />
                  </div>
                  <div className="font-bold font-display flex items-center gap-1.5">
                    {g.label}
                    {!g.live && <Lock className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{g.desc}</div>
                  {g.live && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                      <Coins className="w-3 h-3" /> Open scan →
                    </div>
                  )}
                </>
              );
              return g.live ? (
                <Link
                  key={g.key}
                  to="/earn-credits/battle/scan"
                  className="group relative overflow-hidden rounded-2xl border p-4 bg-card hover:shadow-glow hover:-translate-y-0.5 transition-all"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={g.key}
                  className="relative overflow-hidden rounded-2xl border p-4 bg-card/50 opacity-70 cursor-not-allowed"
                >
                  {inner}
                </div>
              );
            })}
          </div>
        </section>

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
                      {m.status === "pending"
                        ? "Scanning for opponent"
                        : m.status === "coin_flip"
                          ? "Coin flip in progress"
                          : "In game"}
                    </div>
                    <div className="text-xs text-muted-foreground">Stake: {m.stake} PC · random match</div>
                  </div>
                  <Button size="sm">Open</Button>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: Shield, label: "Random match", desc: "No picking users" },
            { icon: Zap, label: "Coin flip", desc: "Heads or tails starts" },
            { icon: Trophy, label: "Winner takes 20", desc: "Draw refunds both" },
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