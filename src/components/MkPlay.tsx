import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, Trophy, Coins, Loader2, RotateCw, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type MkMatch = {
  id: string;
  status: string;
  player_a: string;
  player_b: string | null;
  stake: number;
  game_type: string;
  a_character: string | null;
  b_character: string | null;
  winner: string | null;
  is_draw: boolean;
};

type Profile = { id: string; display_name: string | null };

const CHARACTERS = [
  { id: "Subzero", label: "Sub-Zero", color: "from-cyan-500 to-blue-700", tag: "Ice" },
  { id: "Kano", label: "Kano", color: "from-red-500 to-rose-700", tag: "Blade" },
] as const;

// Which pad keys the on-screen controls emit — must match mkjs bridge names.
type PadKey = "LEFT" | "RIGHT" | "UP" | "DOWN" | "BLOCK" | "HP" | "LP" | "HK" | "LK";

type BridgeMsg =
  | { __mkctl: true; type: "press"; player: 0 | 1; key: PadKey }
  | { __mkctl: true; type: "release"; player: 0 | 1; key: PadKey }
  | { __mkctl: true; type: "reset" };

export function MkPlay({ matchId, uid }: { matchId: string; uid: string | null }) {
  const nav = useNavigate();
  const [m, setM] = useState<MkMatch | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(false);
  const [landscape, setLandscape] = useState(true);
  const [iframeReady, setIframeReady] = useState(false);
  const [lives, setLives] = useState<{ p1: number; p2: number }>({ p1: 100, p2: 100 });
  const [localWinner, setLocalWinner] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const settledRef = useRef(false);

  // Load match
  useEffect(() => {
    let mounted = true;
    supabase.from("battle_matches").select("*").eq("id", matchId).maybeSingle().then(({ data }) => {
      if (mounted && data) setM(data as unknown as MkMatch);
    });
    const ch = supabase
      .channel("mk-play-" + matchId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_matches", filter: `id=eq.${matchId}` },
        (payload: any) => setM(payload.new as MkMatch),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  // Load profiles
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
  const opponentName = opponentId ? profiles[opponentId]?.display_name || "Opponent" : "…";
  // I'm always player index 0 = "left" in my own iframe (visual convenience).
  const myIdx = 0 as const;
  const oppIdx = 1 as const;
  const myChar = m ? (isA ? m.a_character : m.b_character) : null;
  const oppChar = m ? (isA ? m.b_character : m.a_character) : null;

  // Realtime input channel — broadcast my pad presses to opponent.
  useEffect(() => {
    if (m?.status !== "active" || !uid) return;
    const ch = supabase.channel(`mk-input-${matchId}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "pad" }, ({ payload }) => {
      // Payload arrives from opponent; apply to my iframe as player index 1.
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      const msg: BridgeMsg = {
        __mkctl: true,
        type: payload.down ? "press" : "release",
        player: oppIdx,
        key: payload.key,
      };
      iframe.contentWindow.postMessage(msg, "*");
    }).subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [m?.status, matchId, uid, oppIdx]);

  // Iframe boot/attack messages
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data as any;
      if (!d || !d.__mk) return;
      if (d.type === "ready") setIframeReady(true);
      else if (d.type === "attack") {
        // d.defender is character lowercase, d.life is %
        setLives((prev) => {
          const key = String(d.defender).toLowerCase() === (myChar || "").toLowerCase() ? "p1" : "p2";
          return { ...prev, [key]: d.life };
        });
      } else if (d.type === "game-end" && !settledRef.current) {
        settledRef.current = true;
        const winnerChar = String(d.winner);
        const winnerId = winnerChar.toLowerCase() === (myChar || "").toLowerCase() ? uid : opponentId;
        setLocalWinner(winnerId ?? null);
        supabase.rpc("battle_mk_finish", { _match_id: matchId, _winner: winnerId ?? undefined as unknown as string }).then(({ error }) => {
          if (error) toast.error(error.message);
        });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [myChar, opponentId, uid, matchId]);

  // Send a pad press: locally to iframe as player 0, plus broadcast to opponent.
  const send = (key: PadKey, down: boolean) => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      const msg: BridgeMsg = { __mkctl: true, type: down ? "press" : "release", player: myIdx, key };
      iframe.contentWindow.postMessage(msg, "*");
    }
    const ch = channelRef.current;
    if (ch) ch.send({ type: "broadcast", event: "pad", payload: { key, down } });
  };

  async function pickCharacter(charId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("battle_mk_pick", { _match_id: matchId, _character: charId });
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

  // Iframe URL — always with ME on the left (p1) using my character.
  const iframeSrc = useMemo(() => {
    if (m?.status !== "active" || !myChar || !oppChar) return null;
    const arena = Math.random() < 0.5 ? "TOWER" : "THRONE_ROOM";
    // Freeze arena per match so both clients agree; use match id as seed:
    const seed = matchId.charCodeAt(0) + matchId.charCodeAt(1);
    const chosen = seed % 2 === 0 ? "THRONE_ROOM" : "TOWER";
    void arena;
    return `/mkjs/play.html?p1=${encodeURIComponent(myChar)}&p2=${encodeURIComponent(oppChar)}&arena=${chosen}`;
  }, [m?.status, myChar, oppChar, matchId]);

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
          <Button asChild className="mt-4"><Link to="/earn-credits/battle">Back</Link></Button>
        </div>
      </AppShell>
    );
  }

  // Character select
  if (m.status === "coin_flip") {
    const taken = new Set([m.a_character, m.b_character].filter(Boolean));
    return (
      <AppShell>
        <div className="max-w-lg mx-auto space-y-5">
          <Link to="/earn-credits/battle" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Battle
          </Link>
          <header className="rounded-3xl border bg-gradient-to-br from-red-500/15 via-card to-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white grid place-items-center shadow-glow">
                <Swords className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold font-display">Choose your fighter</h1>
                <p className="text-xs text-muted-foreground">Random match · vs {opponentName} · Pot {m.stake * 2} PC</p>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3">
            {CHARACTERS.map((c) => {
              const mine = myChar === c.id;
              const oppPicked = oppChar === c.id;
              const disabled = busy || !!myChar || oppPicked;
              return (
                <button
                  key={c.id}
                  disabled={disabled}
                  onClick={() => pickCharacter(c.id)}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-4 text-left transition",
                    mine && "ring-2 ring-primary",
                    disabled && !mine && "opacity-50 cursor-not-allowed",
                    !disabled && "hover:shadow-glow hover:-translate-y-0.5",
                  )}
                >
                  <div className={cn("w-full aspect-square rounded-xl bg-gradient-to-br mb-2 grid place-items-center text-white font-black text-2xl", c.color)}>
                    {c.label.split("-").map((s) => s[0]).join("")}
                  </div>
                  <div className="font-bold font-display">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.tag}</div>
                  {mine && <span className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-bold">YOU</span>}
                  {oppPicked && !mine && <span className="absolute top-2 right-2 text-[10px] bg-muted rounded-full px-2 py-0.5 font-bold">TAKEN</span>}
                </button>
              );
            })}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {myChar
              ? oppChar
                ? "Both ready — starting…"
                : "Waiting for opponent to pick…"
              : "Tap a fighter to lock in."}
          </div>

          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={cancel}>Cancel match</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Cancelled / declined
  if (m.status === "cancelled" || m.status === "declined") {
    return (
      <AppShell>
        <div className="max-w-md mx-auto text-center py-20 space-y-3">
          <p className="text-sm text-muted-foreground">Match {m.status}. No credits changed hands.</p>
          <Button asChild><Link to="/earn-credits/battle">Back</Link></Button>
        </div>
      </AppShell>
    );
  }

  const winnerId = m.winner || localWinner;
  const finished = m.status === "finished";
  const iWon = finished && winnerId === uid;

  // Active / finished — arena + pad
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[60] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent">
        <Link to="/earn-credits/battle" className="text-[11px] inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
          <ArrowLeft className="w-3 h-3" /> Exit
        </Link>
        <div className="flex items-center gap-1 text-[11px] font-bold">
          <Coins className="w-3.5 h-3.5 text-amber-400" /> Pot {m.stake * 2}
        </div>
        <button
          onClick={() => setLandscape((v) => !v)}
          className="text-[11px] inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/10"
        >
          <RotateCw className="w-3 h-3" /> {landscape ? "Portrait" : "Landscape"}
        </button>
      </div>

      {/* Arena stage */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-neutral-950">
        <div
          className={cn(
            "relative bg-black origin-center",
            landscape ? "landscape-frame" : "portrait-frame",
          )}
        >
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Fighter arena"
              className="border-0 block"
              style={{ width: 600, height: 420 }}
            />
          ) : (
            <div className="w-[300px] h-[200px] grid place-items-center text-white/60">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {!iframeReady && iframeSrc && (
            <div className="absolute inset-0 grid place-items-center bg-black/70">
              <div className="text-center">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-400" />
                <div className="text-xs mt-2 opacity-70">Preparing arena…</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Life labels */}
      <div className="px-3 py-1 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider bg-black/60">
        <div className="truncate">YOU · {myChar}</div>
        <div className="truncate text-right">{opponentName} · {oppChar}</div>
      </div>

      {/* On-screen controller — only controls my fighter (player 0 in my iframe). */}
      <ControlPad onKey={send} disabled={!iframeReady || finished} />

      {/* Result overlay */}
      {finished && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6">
          <div className="max-w-sm w-full bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/10 rounded-3xl p-6 text-center space-y-3">
            <Trophy className={cn("w-12 h-12 mx-auto", iWon ? "text-amber-400" : "text-white/40")} />
            <h2 className="text-lg font-bold font-display">
              {m.is_draw ? "Draw — stakes refunded" : iWon ? `🏆 You won ${m.stake * 2} PC!` : `${opponentName} won this round`}
            </h2>
            <div className="flex justify-center gap-2">
              <Button asChild><Link to="/earn-credits/battle/scan" search={{ game: "mk" }}>Play again</Link></Button>
              <Button variant="outline" asChild><Link to="/earn-credits/battle">Back</Link></Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .landscape-frame { transform: none; }
        .portrait-frame { transform: rotate(90deg); }
        /* Show placeholder to guide arena centered without overflow */
      `}</style>
    </div>
  );
}

function ControlPad({ onKey, disabled }: { onKey: (k: PadKey, down: boolean) => void; disabled: boolean }) {
  const active = useRef<Set<PadKey>>(new Set());

  const bind = (k: PadKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      if (!active.current.has(k)) {
        active.current.add(k);
        onKey(k, true);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (active.current.has(k)) {
        active.current.delete(k);
        onKey(k, false);
      }
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    },
    onPointerCancel: () => {
      if (active.current.has(k)) {
        active.current.delete(k);
        onKey(k, false);
      }
    },
    onPointerLeave: () => {
      if (active.current.has(k)) {
        active.current.delete(k);
        onKey(k, false);
      }
    },
  });

  const dPad = "w-12 h-12 rounded-xl bg-white/10 border border-white/20 backdrop-blur active:bg-primary/60 active:scale-95 grid place-items-center text-white font-black select-none touch-none transition";
  const btn = (color: string) =>
    `w-14 h-14 rounded-full border-2 border-white/30 active:scale-95 grid place-items-center text-white font-black select-none touch-none shadow-lg ${color}`;

  return (
    <div className="grid grid-cols-2 gap-4 px-4 py-4 bg-gradient-to-t from-black to-black/60 border-t border-white/10">
      {/* D-Pad */}
      <div className="flex flex-col items-center gap-1">
        <button className={dPad} {...bind("UP")} aria-label="Up">↑</button>
        <div className="flex gap-1">
          <button className={dPad} {...bind("LEFT")} aria-label="Left">←</button>
          <button className={cn(dPad, "opacity-40 pointer-events-none")}>·</button>
          <button className={dPad} {...bind("RIGHT")} aria-label="Right">→</button>
        </div>
        <button className={dPad} {...bind("DOWN")} aria-label="Down">↓</button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 place-items-center">
        <button className={btn("bg-yellow-500/90")} {...bind("HP")}>HP</button>
        <button className={btn("bg-orange-500/90")} {...bind("LP")}>LP</button>
        <button className={btn("bg-red-500/90")} {...bind("HK")}>HK</button>
        <button className={btn("bg-pink-500/90")} {...bind("LK")}>LK</button>
        <button className={btn("bg-sky-600/90 col-span-2 w-32 h-10 rounded-full")} {...bind("BLOCK")}>BLOCK</button>
      </div>
    </div>
  );
}
