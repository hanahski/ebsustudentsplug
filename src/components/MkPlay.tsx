import { Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeft, Trophy, Coins, Loader2, RotateCw, Swords, Wifi, WifiOff,
  ArrowUp, ArrowDown, ArrowLeft as ArrLeft, ArrowRight, Zap, Shield, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  { id: "Subzero", label: "Sub-Zero", color: "from-cyan-500 to-blue-700", tag: "Ice", hp: 100,
    passives: ["Frost Focus: block a hit → next counter +2 dmg"], signature: "Balanced ice ninja." },
  { id: "Kano", label: "Kano", color: "from-red-500 to-rose-700", tag: "Blade", hp: 100,
    passives: ["Berserker: while HP ≤ 30, landed hits +2 dmg"], signature: "Comeback fighter." },
  { id: "Omar", label: "Omar", color: "from-pink-500 to-fuchsia-700", tag: "Rose Fury", hp: 120,
    passives: ["Rose Guard: +20 HP", "Iron Will: −15% dmg taken", "Rose Fury every 3rd hit"], signature: "Tanky bruiser." },
] as const;

type PadKey = "LEFT" | "RIGHT" | "UP" | "DOWN" | "BLOCK" | "HP" | "LP" | "HK" | "LK";
type Pov = "p1-right" | "p2-right";

type BridgeMsg =
  | { __mkctl: true; type: "press"; player: 0 | 1; key: PadKey }
  | { __mkctl: true; type: "release"; player: 0 | 1; key: PadKey }
  | { __mkctl: true; type: "spectate"; snap: unknown }
  | { __mkctl: true; type: "reset" };

// Native game canvas dimensions — never change these.
const ARENA_W = 600;
const ARENA_H = 400;

export function MkPlay({ matchId, uid }: { matchId: string; uid: string | null }) {
  const nav = useNavigate();
  const [m, setM] = useState<MkMatch | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [hostConnected, setHostConnected] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [snapAgeMs, setSnapAgeMs] = useState(0);
  const [localWinner, setLocalWinner] = useState<string | null>(null);
  const [portrait, setPortrait] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const settledRef = useRef(false);
  const lastSnapAtRef = useRef<number>(0);

  // Load match + subscribe
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
        (payload: unknown) => setM((payload as { new: MkMatch }).new),
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  useEffect(() => {
    if (!m) return;
    const ids = [m.player_a, m.player_b].filter(Boolean) as string[];
    if (!ids.length) return;
    supabase.from("profiles").select("id,display_name").in("id", ids).then(({ data }) => {
      const map: Record<string, Profile> = {};
      (data as Profile[] | null)?.forEach((p) => (map[p.id] = p));
      setProfiles(map);
    });
  }, [m?.player_a, m?.player_b]);

  const isHost = !!uid && m?.player_a === uid;
  const isGuest = !!uid && m?.player_b === uid;
  const meIsPlayer = isHost || isGuest;
  const opponentId = m ? (isHost ? m.player_b : m.player_a) : null;
  const opponentName = opponentId ? profiles[opponentId]?.display_name || "Opponent" : "…";
  const myName = uid ? profiles[uid]?.display_name || "You" : "You";

  const aChar = m?.a_character || null;
  const bChar = m?.b_character || null;
  const myChar = isHost ? aChar : bChar;
  const oppChar = isHost ? bChar : aChar;
  const pov: Pov = isHost ? "p1-right" : "p2-right";

  // Detect orientation for adaptive controls
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight >= window.innerWidth);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Broadcast channel: subscribe as soon as we know we're an active/soon-active player
  // to reduce cold-start latency at "FIGHT!".
  useEffect(() => {
    if (!uid || !m) return;
    if (m.status !== "active" && m.status !== "coin_flip") return;
    const ch = supabase.channel(`mk-net-${matchId}`, { config: { broadcast: { self: false } } });

    if (isHost) {
      ch.on("broadcast", { event: "pad" }, ({ payload }) => {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        const p = payload as { down: boolean; key: PadKey };
        const msg: BridgeMsg = { __mkctl: true, type: p.down ? "press" : "release", player: 1, key: p.key };
        iframe.contentWindow.postMessage(msg, "*");
      });
      ch.on("broadcast", { event: "ping" }, ({ payload }) => {
        ch.send({ type: "broadcast", event: "pong", payload: { t: (payload as { t: number }).t } });
      });
    } else if (isGuest) {
      ch.on("broadcast", { event: "snap" }, ({ payload }) => {
        lastSnapAtRef.current = Date.now();
        setHostConnected(true);
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        const msg: BridgeMsg = { __mkctl: true, type: "spectate", snap: (payload as { snap: unknown }).snap };
        iframe.contentWindow.postMessage(msg, "*");
      });
      ch.on("broadcast", { event: "gameover" }, ({ payload }) => {
        setLocalWinner((payload as { winnerId: string | null }).winnerId ?? null);
      });
      ch.on("broadcast", { event: "pong" }, ({ payload }) => {
        setLatencyMs(Date.now() - (payload as { t: number }).t);
      });
    }
    ch.subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [m?.status, matchId, uid, isHost, isGuest, m]);

  // Guest: ping host every 2s + slow-network watchdog based on snap age
  useEffect(() => {
    if (!isGuest || m?.status !== "active") return;
    const pingHandle = setInterval(() => {
      const ch = channelRef.current;
      if (ch) ch.send({ type: "broadcast", event: "ping", payload: { t: Date.now() } });
    }, 2000);
    const ageHandle = setInterval(() => {
      const age = Date.now() - lastSnapAtRef.current;
      setSnapAgeMs(age);
      if (age > 3000) setHostConnected(false);
    }, 500);
    return () => { clearInterval(pingHandle); clearInterval(ageHandle); };
  }, [isGuest, m?.status]);

  // Messages from iframe
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = ev.data as { __mk?: boolean; type?: string; snap?: unknown; winner?: string; winnerSlot?: "p1" | "p2" };
      if (!d || !d.__mk) return;
      if (d.type === "ready") setIframeReady(true);
      else if (d.type === "snap" && isHost) {
        const ch = channelRef.current;
        if (ch) ch.send({ type: "broadcast", event: "snap", payload: { snap: d.snap } });
      } else if (d.type === "game-end" && isHost && !settledRef.current) {
        settledRef.current = true;
        // Prefer authoritative slot from the iframe; fall back to character-name mapping.
        let winnerId: string | null | undefined;
        if (d.winnerSlot === "p1") winnerId = m?.player_a;
        else if (d.winnerSlot === "p2") winnerId = m?.player_b;
        else {
          const wc = String(d.winner ?? "").toLowerCase();
          winnerId = wc === (aChar || "").toLowerCase() ? m?.player_a : m?.player_b;
        }
        setLocalWinner(winnerId ?? null);
        const ch = channelRef.current;
        if (ch) ch.send({ type: "broadcast", event: "gameover", payload: { winnerId } });
        supabase
          .rpc("battle_mk_finish", { _match_id: matchId, _winner: (winnerId ?? undefined) as unknown as string })
          .then(({ error }) => { if (error) toast.error(error.message); });
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [isHost, aChar, matchId, m?.player_a, m?.player_b]);

  const mapLocalKey = useCallback((key: PadKey): PadKey => {
    if (!isHost) return key;
    if (key === "LEFT") return "RIGHT";
    if (key === "RIGHT") return "LEFT";
    return key;
  }, [isHost]);

  // Send a pad press (host → local iframe as p1; guest → broadcast, host applies as p2)
  const send = useCallback((key: PadKey, down: boolean) => {
    if (isHost) {
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        const msg: BridgeMsg = { __mkctl: true, type: down ? "press" : "release", player: 0, key: mapLocalKey(key) };
        iframe.contentWindow.postMessage(msg, "*");
      }
    } else if (isGuest) {
      const ch = channelRef.current;
      if (ch) ch.send({ type: "broadcast", event: "pad", payload: { key, down } });
    }
  }, [isHost, isGuest, mapLocalKey]);

  async function pickCharacter(charId: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("battle_mk_pick", { _match_id: matchId, _character: charId });
      if (error) throw error;
    } catch (e: unknown) {
      toast.error(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await supabase.rpc("battle_cancel", { _match_id: matchId });
    nav({ to: "/earn-credits/battle" });
  }

  const iframeSrc = useMemo(() => {
    if (m?.status !== "active" || !aChar || !bChar) return null;
    const seed = matchId.charCodeAt(0) + matchId.charCodeAt(1);
    const arena = seed % 2 === 0 ? "THRONE_ROOM" : "TOWER";
    const mode = isHost ? "host" : "spectator";
    return `/mkjs/play.html?p1=${encodeURIComponent(aChar)}&p2=${encodeURIComponent(bChar)}&arena=${arena}&mode=${mode}&pov=${pov}`;
  }, [m?.status, aChar, bChar, matchId, isHost, pov]);

  // Responsive scaling: fit the 600×420 arena inside the available stage area.
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const s = Math.min(rect.width / ARENA_W, rect.height / ARENA_H);
      setScale(Math.max(0.3, Math.min(2.5, s)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    return () => { ro.disconnect(); window.removeEventListener("orientationchange", measure); };
  }, [iframeSrc, portrait]);

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

  if (m.status === "pending" || (m.status === "coin_flip" && !m.player_b)) {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto space-y-5 py-6">
          <Link to="/earn-credits/battle" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Battle
          </Link>
          <div className="rounded-3xl border bg-gradient-to-br from-red-500/15 via-card to-card p-8 text-center shadow-card space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white grid place-items-center shadow-glow animate-pulse">
              <Swords className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display">Scanning for an opponent…</h1>
              <p className="text-sm text-muted-foreground mt-1">Match starts as soon as another fighter joins.</p>
            </div>
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
            <Button variant="outline" size="sm" onClick={cancel}>Cancel scan</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (m.status === "coin_flip") {
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
                <p className="text-xs text-muted-foreground">
                  {isHost ? "You are host · " : "You are guest · "}vs {opponentName} · Pot {m.stake * 2} PC
                </p>
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
                  <div className={cn("relative w-full aspect-square rounded-xl bg-gradient-to-br mb-2 grid place-items-center overflow-hidden", c.color)}>
                    <div className="absolute inset-x-3 bottom-2 h-10 rounded-full bg-black/25 blur-xl" />
                    <img
                      src={`/mkjs/images/fighters/${c.id.toLowerCase()}/right/attractive-stand-up/0.png`}
                      alt=""
                      className="relative h-[82%] w-[82%] object-contain drop-shadow-[0_10px_12px_rgba(0,0,0,0.45)]"
                      draggable={false}
                    />
                  </div>
                  <div className="font-bold font-display">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground">{c.tag} · {c.hp} HP</div>
                  <ul className="mt-1.5 space-y-0.5">
                    {c.passives.map((p) => (
                      <li key={p} className="text-[10px] text-muted-foreground leading-snug">• {p}</li>
                    ))}
                  </ul>
                  {mine && <span className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-bold">YOU</span>}
                  {oppPicked && !mine && <span className="absolute top-2 right-2 text-[10px] bg-muted rounded-full px-2 py-0.5 font-bold">TAKEN</span>}
                </button>
              );
            })}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {myChar ? (oppChar ? "Both ready — starting…" : "Waiting for opponent to pick…") : "Tap a fighter to lock in."}
          </div>

          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={cancel}>Cancel match</Button>
          </div>
        </div>
      </AppShell>
    );
  }

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

  const isSlow = isGuest && (snapAgeMs > 800 || (latencyMs !== null && latencyMs > 350));
  const leftFighterLabel = isHost
    ? `${opponentName} · ${bChar}`
    : `${profiles[m.player_a]?.display_name || "Opponent"} · ${aChar}`;
  const rightFighterLabel = isHost
    ? `YOU · ${aChar}`
    : `YOU · ${bChar}`;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col z-[60] overflow-hidden select-none relative">
      {/* Top HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent shrink-0">
        <Link to="/earn-credits/battle" className="text-[11px] inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
          <ArrowLeft className="w-3 h-3" /> Exit
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-bold flex-wrap justify-center">
          <span className="inline-flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-amber-400" /> {m.stake * 2}</span>
          {isGuest && (
            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border",
              hostConnected ? "border-emerald-400/40 text-emerald-300" : "border-red-400/40 text-red-300")}>
              {hostConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {hostConnected ? (isSlow ? "Slow" : "Live") : "Reconnecting"}
            </span>
          )}
          {isGuest && latencyMs !== null && (
            <span className={cn("px-1.5 py-0.5 rounded-full border text-[10px]",
              latencyMs < 150 ? "border-emerald-400/40 text-emerald-300" :
              latencyMs < 350 ? "border-amber-400/40 text-amber-300" :
                                "border-red-400/40 text-red-300")}>
              {latencyMs} ms
            </span>
          )}
        </div>
        <div className="text-[11px] opacity-70">{portrait ? "Portrait" : "Landscape"}</div>
      </div>

      {/* Player names */}
      <div className="px-3 py-1 grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider bg-black/60 shrink-0">
        <div className="truncate">{leftFighterLabel}</div>
        <div className="truncate text-right">{rightFighterLabel}</div>
      </div>

      {/* Arena stage — always shows the FULL 600x420 canvas, scaled to fit */}
      <div ref={stageRef} className="flex-1 relative flex items-center justify-center overflow-hidden bg-neutral-950">
        <div
          className="relative bg-black shadow-[0_0_60px_rgba(255,80,80,0.25)] ring-1 ring-white/10 rounded-md overflow-hidden"
          style={{ width: ARENA_W, height: ARENA_H, transform: `scale(${scale})`, transformOrigin: "center center" }}
        >
          {/* Arena edge markers so the user can see the boundary clearly */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-400/50 via-transparent to-amber-400/50" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-gradient-to-b from-amber-400/50 via-transparent to-amber-400/50" />
          {iframeSrc ? (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              title="Fighter arena"
              className="border-0 block"
              style={{ width: ARENA_W, height: ARENA_H }}
            />
          ) : (
            <div style={{ width: ARENA_W, height: ARENA_H }} className="grid place-items-center text-white/60">
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
          {isSlow && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-red-500/80 px-2 py-0.5 rounded-full animate-pulse">
              Slow network — smoothing frames
            </div>
          )}
        </div>
      </div>

      {/* Adaptive control pad */}
      <ControlPad
        onKey={send}
        disabled={!iframeReady || finished || (isGuest && !hostConnected)}
        portrait={portrait}
        sideLabel="Right fighter"
      />

      {finished && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6">
          <div className="max-w-sm w-full bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/10 rounded-3xl p-6 text-center space-y-3">
            <Trophy className={cn("w-12 h-12 mx-auto", iWon ? "text-amber-400" : "text-white/40")} />
            <h2 className="text-lg font-bold font-display">
              {m.is_draw ? "Draw — stakes refunded" : iWon ? `🏆 ${myName} won ${m.stake * 2} PC!` : `${opponentName} won this round`}
            </h2>
            <div className="flex justify-center gap-2">
              <Button asChild><Link to="/earn-credits/battle/scan" search={{ game: "mk" }}>Play again</Link></Button>
              <Button variant="outline" asChild><Link to="/earn-credits/battle">Back</Link></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Adaptive control pad.
 * - Portrait: D-pad bottom-left, attack cluster bottom-right, block+special centered.
 * - Landscape: D-pad hugs left edge, attacks hug right edge, block+special sit between.
 * All buttons use pointer capture so drags/lifts don't get stuck.
 */
function ControlPad({
  onKey, disabled, portrait, sideLabel,
}: { onKey: (k: PadKey, down: boolean) => void; disabled: boolean; portrait: boolean; sideLabel: string }) {
  const active = useRef<Set<PadKey>>(new Set());

  const press = useCallback((k: PadKey) => {
    if (disabled) return;
    if (!active.current.has(k)) { active.current.add(k); onKey(k, true); }
  }, [disabled, onKey]);

  const release = useCallback((k: PadKey) => {
    if (active.current.has(k)) { active.current.delete(k); onKey(k, false); }
  }, [onKey]);

  const bind = (k: PadKey) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      press(k);
    },
    onPointerUp: (e: React.PointerEvent) => {
      release(k);
      try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    },
    onPointerCancel: () => release(k),
    onLostPointerCapture: () => release(k),
  });

  // Special move = crouch + uppercut (DOWN + HP briefly). Multi-key combo.
  const doSpecial = () => {
    if (disabled) return;
    press("DOWN"); press("HP");
    setTimeout(() => { release("HP"); release("DOWN"); }, 180);
  };
  // Jump-kick = UP + HK
  const doAerialKick = () => {
    if (disabled) return;
    press("UP"); press("HK");
    setTimeout(() => { release("HK"); release("UP"); }, 220);
  };

  const moveSize = portrait ? "h-11 w-11 rounded-xl" : "h-14 w-14 rounded-2xl";
  const attackSize = portrait ? "h-12 w-12" : "h-14 w-14";
  const dPadBtn =
    `${moveSize} bg-white/10 border border-white/20 backdrop-blur active:bg-primary/60 active:scale-95 grid place-items-center text-white select-none touch-none transition disabled:opacity-40 shadow-md pointer-events-auto`;
  const attackBtn = (color: string) =>
    `${attackSize} rounded-full border-2 border-white/30 active:scale-95 grid place-items-center text-white font-black select-none touch-none shadow-lg disabled:opacity-40 pointer-events-auto ${color}`;

  const DPad = (
    <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-fit pointer-events-none">
      <div />
      <button className={dPadBtn} {...bind("UP")} aria-label="Jump"><ArrowUp className="w-6 h-6" /></button>
      <div />
      <button className={dPadBtn} {...bind("LEFT")} aria-label="Left"><ArrLeft className="w-6 h-6" /></button>
      <div className={cn(moveSize, "bg-white/5 border border-white/10 grid place-items-center text-[8px] opacity-60")}>MOVE</div>
      <button className={dPadBtn} {...bind("RIGHT")} aria-label="Right"><ArrowRight className="w-6 h-6" /></button>
      <div />
      <button className={dPadBtn} {...bind("DOWN")} aria-label="Crouch"><ArrowDown className="w-6 h-6" /></button>
      <div />
    </div>
  );

  const Attacks = (
    <div className="grid grid-cols-2 gap-2 w-fit pointer-events-none">
      <button className={attackBtn("bg-yellow-500/90")} {...bind("HP")} title="High Punch">HP</button>
      <button className={attackBtn("bg-orange-500/90")} {...bind("LP")} title="Low Punch">LP</button>
      <button className={attackBtn("bg-red-500/90")} {...bind("HK")} title="High Kick">HK</button>
      <button className={attackBtn("bg-pink-500/90")} {...bind("LK")} title="Low Kick">LK</button>
    </div>
  );

  const Extras = (
    <div className="flex flex-col items-center gap-1.5 pointer-events-none">
      <button
        className={cn("rounded-full bg-sky-600/90 border-2 border-white/30 grid place-items-center text-white font-black shadow-lg active:scale-95 disabled:opacity-40 pointer-events-auto", portrait ? "h-9 w-20 text-[10px]" : "h-11 w-24 text-xs")}
        disabled={disabled}
        {...bind("BLOCK")}
      >
        <span className="inline-flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> BLOCK</span>
      </button>
      <button
        onPointerDown={doSpecial}
        disabled={disabled}
        className={cn("rounded-full bg-gradient-to-r from-fuchsia-600 to-purple-700 border-2 border-white/30 text-white font-black shadow-lg active:scale-95 disabled:opacity-40 inline-flex items-center justify-center gap-1 pointer-events-auto", portrait ? "h-9 w-20 text-[9px]" : "h-10 w-24 text-[11px]")}
      >
        <Zap className="w-3.5 h-3.5" /> SPECIAL
      </button>
      <button
        onPointerDown={doAerialKick}
        disabled={disabled}
        className={cn("rounded-full bg-gradient-to-r from-amber-500 to-red-600 border-2 border-white/30 text-white font-black shadow-lg active:scale-95 disabled:opacity-40 inline-flex items-center justify-center gap-1 pointer-events-auto", portrait ? "h-9 w-20 text-[9px]" : "h-10 w-24 text-[11px]")}
      >
        <Flame className="w-3.5 h-3.5" /> AERIAL
      </button>
    </div>
  );

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-white/10 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <div className="text-center text-[10px] font-bold uppercase tracking-wider text-white/50 pt-1">
        Controls · {sideLabel}
      </div>
      {portrait ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 px-2 py-2">
          {DPad}
          <div className="flex justify-center">{Extras}</div>
          {Attacks}
        </div>
      ) : (
        <div className="flex items-end justify-between gap-4 px-4 py-2">
          {DPad}
          <div className="flex-1 flex justify-center">{Extras}</div>
          {Attacks}
        </div>
      )}
    </div>
  );
}
