import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Trophy, Coins, Loader2, X, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/earn-credits/battle/play/$matchId")({
  component: PlayPage,
  head: () => ({ meta: [{ title: "Battle · Live" }] }),
});

type Match = {
  id: string;
  status: string;
  player_a: string;
  player_b: string | null;
  stake: number;
  mode: string;
  a_choice: string | null;
  b_choice: string | null;
  coin_result: string | null;
  first_player: string | null;
  current_turn: string | null;
  board: (string | null)[];
  winner: string | null;
  is_draw: boolean;
};

type Profile = { id: string; display_name: string | null };

function PlayPage() {
  const { matchId } = Route.useParams();
  const nav = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [m, setM] = useState<Match | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(false);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("battle_matches").select("*").eq("id", matchId).maybeSingle();
      if (error) return;
      setM(data as unknown as Match);
    };
    load();
    const ch = supabase
      .channel("battle-play-" + matchId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_matches", filter: `id=eq.${matchId}` },
        (payload: any) => {
          const next = payload.new as Match;
          setM((prev) => {
            // Trigger flip animation when coin result appears
            if (prev && !prev.coin_result && next.coin_result) {
              setFlipping(true);
              setTimeout(() => setFlipping(false), 1400);
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  // Load player profiles
  useEffect(() => {
    if (!m) return;
    const ids = [m.player_a, m.player_b].filter(Boolean) as string[];
    if (!ids.length) return;
    supabase
      .from("profiles")
      .select("id,display_name")
      .in("id", ids)
      .then(({ data }) => {
        const map: Record<string, Profile> = {};
        (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
        setProfiles(map);
      });
  }, [m?.player_a, m?.player_b]);

  const isA = uid && m?.player_a === uid;
  const isB = uid && m?.player_b === uid;
  const meIsPlayer = Boolean(isA || isB);
  const opponentId = m ? (isA ? m.player_b : m.player_a) : null;
  const opponentName = opponentId ? profiles[opponentId]?.display_name || "Opponent" : "Waiting…";
  const myChoice = m ? (isA ? m.a_choice : m.b_choice) : null;
  const oppChoice = m ? (isA ? m.b_choice : m.a_choice) : null;

  const myTurn = m?.status === "active" && m.current_turn === uid;

  async function pickSide(choice: "heads" | "tails") {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("battle_pick_side", { _match_id: matchId, _choice: choice });
      if (error) throw error;
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function move(cell: number) {
    if (!myTurn || busy) return;
    if (m?.board[cell]) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("battle_move", { _match_id: matchId, _cell: cell });
      if (error) throw error;
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await supabase.rpc("battle_cancel", { _match_id: matchId });
    nav({ to: "/earn-credits/battle" });
  }

  const winLine = useMemo(() => calcWinLine(m?.board ?? []), [m?.board]);

  if (!m) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!meIsPlayer) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-20">
          <p className="text-muted-foreground">This isn't your battle.</p>
          <Button asChild className="mt-4">
            <Link to="/earn-credits/battle">Back</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-5">
        <Link to="/earn-credits/battle" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Battle
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between bg-card border rounded-2xl p-4">
          <PlayerChip
            name={profiles[m.player_a]?.display_name || "Player A"}
            active={m.current_turn === m.player_a && m.status === "active"}
            you={isA === true}
          />
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pot</div>
            <div className="flex items-center gap-1 font-bold">
              <Coins className="w-4 h-4 text-primary" /> {m.stake * 2}
            </div>
          </div>
          <PlayerChip
            name={m.player_b ? profiles[m.player_b]?.display_name || "Player B" : "…"}
            active={m.current_turn === m.player_b && m.status === "active"}
            you={isB === true}
            right
          />
        </div>

        {/* Stage: waiting queue */}
        {m.status === "pending" && (
          <div className="bg-card border rounded-2xl p-6 text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            <h2 className="font-bold font-display text-lg">Scanning for battle…</h2>
            <p className="text-sm text-muted-foreground">
              You are in the random queue. Once another player is selected, coin flip opens automatically.
            </p>
            <Button variant="outline" size="sm" onClick={cancel}>Cancel scan</Button>
          </div>
        )}

        {/* Stage: coin flip */}
        {m.status === "coin_flip" && (
          <div className="bg-card border rounded-2xl p-6 text-center space-y-4">
            <h2 className="font-bold font-display">Coin flip — pick a side</h2>
            <div className="mx-auto w-28 h-28 relative perspective-1000">
              <div
                className={cn(
                  "w-full h-full rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 border-4 border-amber-200 shadow-glow flex items-center justify-center text-2xl font-black text-amber-900 transition-transform duration-700",
                  flipping && "animate-[spin_0.7s_linear_2]",
                )}
              >
                PC
              </div>
            </div>
            {!myChoice ? (
              <div className="flex gap-2 justify-center">
                <Button disabled={busy || oppChoice === "heads"} onClick={() => pickSide("heads")}>
                  Heads {oppChoice === "heads" && "(taken)"}
                </Button>
                <Button disabled={busy || oppChoice === "tails"} onClick={() => pickSide("tails")}>
                  Tails {oppChoice === "tails" && "(taken)"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You picked <b>{myChoice}</b>. Waiting for opponent…
              </p>
            )}
          </div>
        )}

        {/* Stage: active or finished game board */}
        {(m.status === "active" || m.status === "finished") && (
          <>
            {m.status === "active" && (
              <div className="text-center text-sm">
                <span className={cn("px-3 py-1 rounded-full", myTurn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {myTurn ? "Your move" : opponentName + "'s move"}
                </span>
              </div>
            )}

            <div className="mx-auto grid grid-cols-3 gap-2 max-w-xs relative rounded-3xl bg-gradient-to-br from-primary/15 via-card to-red-500/10 p-3 shadow-card border">
              {m.board.map((cell, i) => {
                const takenBy = cell as string | null;
                const isMine = takenBy && takenBy === uid;
                const isOpp = takenBy && takenBy !== uid;
                const highlight = winLine?.includes(i);
                return (
                  <button
                    key={i}
                    disabled={!myTurn || !!cell || m.status !== "active" || busy}
                    onClick={() => move(i)}
                    className={cn(
                      "aspect-square rounded-2xl border-2 flex items-center justify-center bg-background transition-all duration-200 shadow-sm",
                      myTurn && !cell && "hover:border-primary hover:shadow-glow hover:scale-[1.03] cursor-pointer",
                      !myTurn && "cursor-not-allowed",
                      highlight && "bg-primary/20 border-primary",
                    )}
                  >
                    {isMine && <X className="w-12 h-12 text-primary animate-in zoom-in duration-200" strokeWidth={3} />}
                    {isOpp && <Circle className="w-10 h-10 text-red-500 animate-in zoom-in duration-200" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>

            {m.status === "finished" && (
              <div className="bg-card border rounded-2xl p-6 text-center space-y-3">
                <Trophy className={cn("w-10 h-10 mx-auto", m.winner === uid ? "text-amber-500" : "text-muted-foreground")} />
                <h2 className="font-bold font-display text-lg">
                  {m.is_draw
                    ? "Draw — stakes refunded"
                    : m.winner === uid
                      ? "🏆 You won " + m.stake * 2 + " PC!"
                      : opponentName + " won this round"}
                </h2>
                <div className="flex justify-center gap-2">
                  <Button asChild>
                    <Link to="/earn-credits/battle/scan">Play again</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/earn-credits/battle">Back</Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {(m.status === "cancelled" || m.status === "declined") && (
          <div className="bg-card border rounded-2xl p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Match {m.status}. No credits changed hands.
            </p>
            <Button asChild>
              <Link to="/earn-credits/battle">Back</Link>
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PlayerChip({ name, active, you, right }: { name: string; active: boolean; you: boolean; right?: boolean }) {
  return (
    <div className={cn("flex-1 min-w-0", right && "text-right")}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {you ? "You" : "Opponent"}
      </div>
      <div className={cn("font-semibold text-sm truncate", active && "text-primary")}>{name}</div>
    </div>
  );
}

function calcWinLine(board: (string | null)[]): number[] | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const ln of lines) {
    const [a, b, c] = ln;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return ln;
  }
  return null;
}
