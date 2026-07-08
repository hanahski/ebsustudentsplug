import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ScanLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceHash } from "@/lib/device-hash";
import { toast } from "sonner";
import { AvatarDisplay } from "@/components/AvatarDisplay";

export const Route = createFileRoute("/earn-credits/battle/scan")({
  component: ScanPage,
  head: () => ({ meta: [{ title: "Scan for Battle" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    game: (s.game as string) === "mk" ? "mk" : "tictactoe",
  }),
});

type GameKey = "tictactoe" | "mk";
const GAME_LABEL: Record<GameKey, string> = {
  tictactoe: "Tic-Tac-Toe · 2 players",
  mk: "Fighter Battle · 2 players",
};

function ScanPage() {
  const nav = useNavigate();
  const { game } = Route.useSearch();
  const gameKey = game as GameKey;
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_key: string | null } | null>(null);
  const [searching, setSearching] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const startingRef = useRef(false);
  const matchIdRef = useRef<string | null>(null);

  // Cancel any leftover pending random matches I own (from a previous session /
  // hard-refresh / accidental double-tap). Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me || cancelled) return;
      setUid(me);
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_key")
        .eq("id", me)
        .maybeSingle();
      if (!cancelled) setProfile(prof ?? null);

      const { data: mine } = await supabase
        .from("battle_matches")
        .select("id")
        .eq("player_a", me)
        .eq("status", "pending")
        .eq("mode", "random");
      for (const row of mine ?? []) {
        await supabase.rpc("battle_cancel", { _match_id: (row as any).id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime on my own pending match → jump to play once matched.
  useEffect(() => {
    if (!matchId) return;
    const ch = supabase
      .channel("battle-scan-" + matchId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "battle_matches", filter: `id=eq.${matchId}` },
        (payload: any) => {
          const s = payload.new?.status;
          if (s === "coin_flip" || s === "active") {
            // Clear ref FIRST so the unmount cleanup doesn't cancel the live match.
            matchIdRef.current = null;
            nav({ to: "/earn-credits/battle/play/$matchId", params: { matchId } });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId, nav]);

  // On unmount while still searching, cancel my pending match so it doesn't
  // linger in the queue. Ref is cleared before navigation, so live matches
  // are never cancelled here.
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  useEffect(() => {
    return () => {
      const id = matchIdRef.current;
      if (id) {
        supabase.rpc("battle_cancel", { _match_id: id }).then(() => {});
      }
    };
  }, []);

  async function startRandom() {
    if (startingRef.current || searching) return;
    startingRef.current = true;
    setSearching(true);
    try {
      // Belt-and-braces: cancel any stray pending match I might already have
      // before creating a new one (prevents double-profile in the queue).
      if (uid) {
        const { data: mine } = await supabase
          .from("battle_matches")
          .select("id")
          .eq("player_a", uid)
          .eq("status", "pending")
          .eq("mode", "random");
        for (const row of mine ?? []) {
          await supabase.rpc("battle_cancel", { _match_id: (row as any).id });
        }
      }

      const { data, error } = await supabase.rpc("battle_matchmake", {
        _device_hash: getDeviceHash(),
        _game_type: gameKey,
      });
      if (error) throw error;
      const id = data as unknown as string;
      const { data: m } = await supabase.from("battle_matches").select("status,player_b").eq("id", id).maybeSingle();
      if (m && (m.status === "coin_flip" || m.status === "active")) {
        // Matched immediately — clear ref so unmount cleanup can't cancel it.
        matchIdRef.current = null;
        nav({ to: "/earn-credits/battle/play/$matchId", params: { matchId: id } });
        return;
      }
      setMatchId(id);

    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("INSUFFICIENT_CREDITS")) toast.error("You need at least 10 PC to battle.");
      else toast.error(msg);
      setSearching(false);
    } finally {
      startingRef.current = false;
    }
  }

  async function cancelSearch() {
    const id = matchId;
    setMatchId(null);
    setSearching(false);
    if (id) {
      await supabase.rpc("battle_cancel", { _match_id: id });
    }
  }

  return (
    <div className="fixed inset-0 bg-white text-[#2a1e2a] overflow-hidden flex flex-col z-0">
      <style>{scannerCss}</style>

      {/* Top bar */}
      <div className="relative z-30 flex items-center justify-between px-4 pt-4">
        <Link
          to="/earn-credits/battle"
          className="text-xs text-[#673c63] hover:opacity-80 inline-flex items-center gap-1 bg-white/70 backdrop-blur px-3 py-1.5 rounded-full border border-[#673c63]/20"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Battle
        </Link>
        <div className="text-[11px] font-semibold text-[#673c63] bg-white/70 backdrop-blur px-3 py-1.5 rounded-full border border-[#673c63]/20">
          {GAME_LABEL[gameKey]}
        </div>
      </div>

      {/* Scanner card — just YOU. Tic-tac-toe is a 2-player random match, so
          we don't show a live queue of other searchers here. */}
      <div className="relative z-20 mt-6 mx-3 rounded-3xl border border-[#673c63]/25 bg-white/60 backdrop-blur-md shadow-[0_10px_30px_-15px_rgba(103,60,99,0.4)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-3">
          <ScanLine className="w-4 h-4 text-[#673c63]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#673c63]">
            {searching ? "Scanning for opponent…" : "Ready to scan"}
          </span>
        </div>

        <div className="relative px-3 py-8 min-h-[160px] flex items-center justify-center">
          {searching && <div className="scanner-beam" aria-hidden />}
          <div className="scanner-user flex flex-col items-center gap-2">
            <div className="relative">
              {searching && (
                <>
                  <div className="absolute inset-0 rounded-full ring-2 ring-[#673c63]/40 animate-ping [animation-duration:2.4s]" />
                  <div className="absolute -inset-2 rounded-full ring-2 ring-[#673c63]/20 animate-ping [animation-duration:3s]" />
                </>
              )}
              <div className="relative rounded-full ring-2 ring-[#673c63]/50 bg-white p-1">
                <AvatarDisplay avatarKey={profile?.avatar_key ?? "boy-1"} size={72} />
              </div>
              <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-[#673c63] text-white rounded-full px-1.5 py-0.5">
                you
              </span>
            </div>
            <div className="text-xs font-semibold text-[#2a1e2a] truncate text-center max-w-[160px]">
              {profile?.display_name || "You"}
            </div>
          </div>
        </div>
      </div>

      {/* CTA block */}
      <div className="relative z-20 mt-6 px-4 text-center">
        <h1 className="text-xl font-bold text-[#2a1e2a]">
          {searching ? "Finding your opponent…" : "Scan for Battle"}
        </h1>
        <p className="text-xs text-[#673c63] mt-1 max-w-sm mx-auto">
          {searching
            ? "You'll be randomly paired with another player. Then a coin flip decides who starts. Winner takes 20 PC, draw refunds both."
            : "Random match only — no picking. 10 PC stake · Winner takes 20 PC · Draw refunds both."}
        </p>
        <div className="mt-4 flex justify-center">
          {!searching ? (
            <Button
              size="lg"
              onClick={startRandom}
              className="rounded-full px-8 bg-[#673c63] hover:bg-[#54314f] text-white shadow-lg"
            >
              <ScanLine className="w-4 h-4 mr-2" /> Start scan
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              onClick={cancelSearch}
              className="rounded-full px-8 border-[#673c63]/50 text-[#673c63] bg-white"
            >
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancel search
            </Button>
          )}
        </div>
      </div>

      {/* Candle background — anchored to bottom, does not cover the scanner */}
      <div className="candle-stage" aria-hidden>
        <div className="wrapper">
          <div className="candles">
            <div className="candle1">
              <div className="candle1__stick" />
              <div className="candle1__eyes">
                <div className="candle1__eyes-one" />
                <div className="candle1__eyes-two" />
              </div>
              <div className="candle1__mouth" />
              <div className="candle__smoke-one" />
              <div className="candle__smoke-two" />
            </div>
            <div className="candle2">
              <div className="candle2__stick" />
              <div className="candle2__eyes">
                <div className="candle2__eyes-one" />
                <div className="candle2__eyes-two" />
              </div>
              <div className="light__wave" />
              <div className="candle2__fire" />
            </div>
          </div>
          <div className="floor" />
        </div>
      </div>
    </div>
  );
}

const scannerCss = `
/* Scanner sweeping beam */
.scanner-beam {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(103,60,99,0.22) 50%, transparent 100%);
  width: 30%;
  animation: scanner-sweep 2.4s linear infinite;
  mix-blend-mode: multiply;
}
@keyframes scanner-sweep {
  0% { transform: translateX(-40%); }
  100% { transform: translateX(360%); }
}
.scanner-user {
  animation: user-pulse 2.4s ease-in-out infinite;
}
@keyframes user-pulse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* Candle stage — bottom aligned */
.candle-stage {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 55%;
  pointer-events: none;
  z-index: 10;
}
.candle-stage .wrapper {
  position: absolute;
  left: 50%;
  top: 70%;
  width: 250px;
  height: 250px;
  transform: translate(-50%, -50%) scale(1.4);
  transform-origin: center center;
}
.candle-stage .floor {
  position: absolute; left: 50%; top: 50%;
  width: 350px; height: 5px; background: #673c63;
  transform: translate(-50%, -50%);
  box-shadow: 0px 2px 5px #111;
  z-index: 2;
}
.candle-stage .candles {
  position: absolute; left: 50%; top: 50%;
  width: 250px; height: 150px;
  transform: translate(-50%, -100%);
  z-index: 1;
}
.candle-stage .candle1 {
  position: absolute; left: 50%; top: 50%;
  width: 35px; height: 100px; background: #fff;
  border: 3px solid #673c63; border-bottom: 0; border-radius: 3px;
  transform-origin: center right;
  transform: translate(60%, -25%);
  box-shadow: -2px 0 0 #95c6f2 inset;
  animation: expand-body 3s infinite linear;
}
.candle-stage .candle1__stick, .candle-stage .candle2__stick {
  position: absolute; left: 50%; top: 0;
  width: 3px; height: 15px; background: #673c63;
  border-radius: 8px; transform: translate(-50%, -100%);
}
.candle-stage .candle2__stick {
  height: 12px; transform-origin: bottom center;
  animation: stick-animation 3s infinite linear;
}
.candle-stage .candle1__eyes, .candle-stage .candle2__eyes {
  position: absolute; left: 50%; top: 0;
  width: 35px; height: 30px; transform: translate(-50%, 0%);
}
.candle-stage .candle1__eyes-one {
  position: absolute; left: 30%; top: 20%;
  width: 5px; height: 5px; border-radius: 100%; background: #673c63;
  transform: translate(-70%, 0%); animation: blink-eyes 3s infinite linear;
}
.candle-stage .candle1__eyes-two {
  position: absolute; left: 70%; top: 20%;
  width: 5px; height: 5px; border-radius: 100%; background: #673c63;
  transform: translate(-70%, 0%); animation: blink-eyes 3s infinite linear;
}
.candle-stage .candle1__mouth {
  position: absolute; left: 40%; top: 20%;
  width: 0; height: 0; border-radius: 20px; background: #673c63;
  transform: translate(-50%, -50%); animation: uff 3s infinite linear;
}
.candle-stage .candle__smoke-one {
  position: absolute; left: 30%; top: 50%;
  width: 30px; height: 3px; background: grey;
  transform: translate(-50%, -50%); animation: move-left 3s infinite linear;
}
.candle-stage .candle__smoke-two {
  position: absolute; left: 30%; top: 40%;
  width: 10px; height: 10px; border-radius: 10px; background: grey;
  transform: translate(-50%, -50%); animation: move-top 3s infinite linear;
}
.candle-stage .candle2 {
  position: absolute; left: 20%; top: 65%;
  width: 42px; height: 60px; background: #fff;
  border: 3px solid #673c63; border-bottom: 0; border-radius: 3px;
  transform: translate(60%, -15%); transform-origin: center right;
  box-shadow: -2px 0 0 #95c6f2 inset;
  animation: shake-left 3s infinite linear;
}
.candle-stage .candle2__eyes-one {
  position: absolute; left: 30%; top: 50%;
  width: 5px; height: 5px; display: inline-block; border-radius: 100%;
  background: #673c63; transform: translate(-80%, 0%);
  animation: changeto-lower 3s infinite linear;
}
.candle-stage .candle2__eyes-two {
  position: absolute; left: 70%; top: 50%;
  width: 5px; height: 5px; display: inline-block; border-radius: 100%;
  background: #673c63; transform: translate(-80%, 0%);
  animation: changeto-greater 3s infinite linear;
}
.candle-stage .light__wave {
  position: absolute; top: 35%; left: 35%;
  width: 75px; height: 75px; border-radius: 100%; z-index: 0;
  transform: translate(-25%, -50%) scale(2.5, 2.5);
  border: 2px solid rgba(255,255,255,0.2);
  animation: expand-light 3s infinite linear;
}
.candle-stage .candle2__fire {
  position: absolute; top: 50%; left: 40%;
  width: 16px; height: 20px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  background: #ff9800; transform: translate(-50%, -50%);
  animation: dance-fire 3s infinite linear;
}
@keyframes blink-eyes {
  0%,35% { opacity:1; transform: translate(-70%,0%); }
  36%,39% { opacity:0; transform: translate(-70%,0%); }
  40% { opacity:1; transform: translate(-70%,0%); }
  50%,65% { transform: translate(-140%,0%); }
  66% { transform: translate(-70%,0%); }
}
@keyframes expand-body {
  0%,40% { transform: scale(1,1) translate(60%,-25%); }
  45%,55% { transform: scale(1.1,1.1) translate(60%,-28%); }
  60% { transform: scale(0.89,0.89) translate(60%,-25%); }
  65% { transform: scale(1,1) translate(60%,-25%); }
  70% { transform: scale(0.95,0.95) translate(60%,-25%); }
  75% { transform: scale(1,1) translate(60%,-25%); }
}
@keyframes uff {
  0%,40% { width:0; height:0; }
  50%,54% { width:15px; height:15px; left:30%; }
  59% { width:5px; height:5px; left:20%; }
  62% { width:2px; height:2px; left:20%; }
  67% { width:0; height:0; left:30%; }
}
@keyframes move-left {
  0%,59%,100% { width:0; left:40%; }
  60% { width:30px; left:30%; }
  68% { width:0; left:20%; }
}
@keyframes move-top {
  0%,64%,100% { width:0; height:0; top:0%; }
  65% { width:10px; height:10px; top:40%; left:40%; }
  80% { width:0; height:0; top:20%; }
}
@keyframes shake-left {
  0%,40% { left:20%; transform: translate(60%,-15%); }
  50%,54% { left:20%; transform: translate(60%,-15%); }
  59% { left:20%; transform: translate(60%,-15%); }
  62% { left:18%; transform: translate(60%,-15%); }
  65% { left:21%; transform: translate(60%,-15%); }
  67% { left:20%; transform: translate(60%,-15%); }
  75% { left:20%; transform: scale(1.15,0.85) translate(60%,-15%); background:#fff; border-color:#673c63; }
  91% { left:20%; transform: scale(1.18,0.82) translate(60%,-10%); background:#f44336; border-color:#f44336; box-shadow:-2px 0 0 #f44336 inset; }
  92% { left:20%; transform: scale(0.85,1.15) translate(60%,-15%); }
  95% { left:20%; transform: scale(1.05,0.95) translate(60%,-15%); }
  97% { left:20%; transform: scale(1,1) translate(60%,-15%); }
}
@keyframes stick-animation {
  0%,40% { left:50%; top:0; transform: translate(-50%,-100%); }
  50%,54% { left:50%; top:0; transform: translate(-50%,-100%); }
  59% { left:50%; top:0; transform: translate(-50%,-100%); }
  62% { transform: rotateZ(-15deg) translate(-50%,-100%); }
  65% { transform: rotateZ(15deg) translate(-50%,-100%); }
  70% { transform: rotateZ(-5deg) translate(-50%,-100%); }
  72% { transform: rotateZ(5deg) translate(-50%,-100%); }
  74%,84% { transform: rotateZ(0deg) translate(-50%,-100%); }
  85% { transform: rotateZ(180deg) translate(0%,120%); }
  92% { transform: translate(-50%,-100%); }
}
@keyframes expand-light {
  10%,29%,59%,89% { transform: translate(-25%,-50%) scale(0,0); border:2px solid rgba(255,255,255,0); }
  90%,20%,50% { transform: translate(-25%,-50%) scale(1,1); }
  95%,96%,26%,27%,56%,57% { transform: translate(-25%,-50%) scale(2,2); border:2px solid rgba(255,255,255,0.5); }
  0%,28%,58%,100% { transform: translate(-25%,-50%) scale(2.5,2.5); border:2px solid rgba(255,255,255,0.2); }
}
@keyframes dance-fire {
  59%,89% { left:40%; width:0; height:0; }
  90%,0%,7%,15%,23%,31%,39%,47%,55% { left:40.8%; width:16px; height:20px; background:#ffc107; }
  94%,3%,11%,19%,27%,35%,43%,51%,58% { left:41.2%; width:16px; height:20px; background:#ff9800; }
}
@keyframes changeto-lower {
  0%,70%,90% { padding:0; border-radius:100%; background:#673c63; border-width:0; border:0 solid #673c63; transform: translate(-90%,0%); }
  71%,89% { background:none; border: solid #673c63; border-radius:0; border-width:0 2px 2px 0; padding:1px;
    transform-origin: bottom left; transform: rotate(-45deg) translate(-50%,-65%); }
}
@keyframes changeto-greater {
  0%,70%,90% { top:50%; padding:0; border-radius:100%; background:#673c63; border-width:0; border:0 solid #673c63; transform: translate(-80%,0%); }
  71%,89% { top:30%; background:none; border: solid #673c63; border-radius:0; border-width:0 2px 2px 0; padding:1px;
    transform-origin: bottom left; transform: rotate(135deg) translate(-80%,20%); }
}
`;
