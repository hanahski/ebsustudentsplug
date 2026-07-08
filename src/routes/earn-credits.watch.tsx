import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Coins, PlayCircle, Loader2, ShieldCheck, Clock, Video, MousePointerClick, X } from "lucide-react";

export const Route = createFileRoute("/earn-credits/watch")({
  component: WatchEarnPage,
  head: () => ({ meta: [{ title: "Watch & Earn — StudentsPlug" }] }),
});

const PER_VIEW = 0.1; // Plug Credits per view
const DAILY_CAP = 15;
const HOLD_MS = 20_000;      // popunder-only: 20s hold before claim allowed
const FAST_RETURN_MS = 5_000; // <5s focus return = suspicious (popunder)
const POPUNDER_SRC =
  "https://pl30191443.effectivecpmnetwork.com/42/2e/9c/422e9c1120d4e5695c47b9c2d592ca75.js";
const VAST_TAG_URL = "https://youradexchange.com/video/select.php?r=11575442";
const FLUID_PLAYER_SRC = "https://cdn.fluidplayer.com/v3/current/fluidplayer.min.js";
const MIN_AD_MS = 5_000; // sanity floor — anything shorter is not a real ad view

type Phase = "idle" | "holding" | "ready" | "claiming";
type Mode = "video" | "popunder";

declare global {
  interface Window {
    fluidPlayer?: (id: string | HTMLVideoElement, opts?: any) => any;
  }
}

function makeToken() {
  try {
    // @ts-ignore
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch { /* no-op */ }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function WatchEarnPage() {
  const nav = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [mode, setMode] = useState<Mode>("video");
  const [viewsToday, setViewsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [holdRemaining, setHoldRemaining] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const clickTimeRef = useRef<number>(0);
  const holdTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fluidInstanceRef = useRef<any>(null);
  const fullscreenElRef = useRef<HTMLDivElement | null>(null);
  const [videoBooting, setVideoBooting] = useState(false);
  const [videoAdPlaying, setVideoAdPlaying] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false); // fullscreen overlay visibility

  // Anti-cheat session state
  const sessionTokenRef = useRef<string | null>(null);
  const sessionValidRef = useRef<boolean>(false);
  const adStartAtRef = useRef<number>(0);
  const adCompletedRef = useRef<boolean>(false);
  const claimInFlightRef = useRef<boolean>(false);

  useEffect(() => { if (user === null) nav({ to: "/login" }); }, [user, nav]);

  // Preload the popunder script once so the first tap has a real user-gesture.
  const popunderReady = useRef(false);
  useEffect(() => {
    if (popunderReady.current) return;
    try {
      if (!document.querySelector(`script[src="${POPUNDER_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = POPUNDER_SRC;
        s.async = true;
        document.body.appendChild(s);
      }
      popunderReady.current = true;
    } catch { /* no-op */ }
  }, []);

  // Load Fluid Player script once.
  const [fluidReady, setFluidReady] = useState(!!(typeof window !== "undefined" && window.fluidPlayer));
  useEffect(() => {
    if (fluidReady) return;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${FLUID_PLAYER_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => setFluidReady(true), { once: true });
      if (window.fluidPlayer) setFluidReady(true);
      return;
    }
    const s = document.createElement("script");
    s.src = FLUID_PLAYER_SRC;
    s.async = true;
    s.onload = () => setFluidReady(true);
    document.body.appendChild(s);
  }, [fluidReady]);

  // Load today's view count.
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("credit_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("reason", "popunder_view")
        .gte("created_at", since.toISOString());
      setViewsToday(count ?? 0);
      setLoading(false);
    })();
  }, [user]);

  // Fast-return detector (popunder mode only).
  useEffect(() => {
    const onFocus = () => {
      if (phase !== "holding" || mode !== "popunder") return;
      const elapsed = Date.now() - clickTimeRef.current;
      if (elapsed < FAST_RETURN_MS) setFlagged(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [phase, mode]);

  const remaining = Math.max(0, DAILY_CAP - viewsToday);
  const capped = remaining <= 0;

  // ---- video session teardown / reset ----
  const teardownVideo = useCallback((opts?: { closeOverlay?: boolean }) => {
    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
    fluidInstanceRef.current = null;
    setVideoAdPlaying(false);
    setVideoBooting(false);
    if (opts?.closeOverlay !== false) setVideoOpen(false);
    // Exit fullscreen if we're in it
    try {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    } catch { /* no-op */ }
  }, []);

  const invalidateSession = useCallback((reason: string) => {
    if (!sessionValidRef.current) return;
    sessionValidRef.current = false;
    sessionTokenRef.current = null;
    adCompletedRef.current = false;
    toast.error(`Ad view cancelled: ${reason}. No reward earned.`);
    teardownVideo();
    setPhase("idle");
  }, [teardownVideo]);

  // Cleanup on unmount / mode switch
  useEffect(() => {
    return () => { teardownVideo(); };
  }, [teardownVideo]);
  useEffect(() => {
    if (mode !== "video") teardownVideo();
  }, [mode, teardownVideo]);

  // Anti-tamper listeners — only active while a video ad session is live
  useEffect(() => {
    if (!videoOpen) return;

    const onVisibility = () => {
      if (document.visibilityState === "hidden" && sessionValidRef.current && !adCompletedRef.current) {
        invalidateSession("you left the ad");
      }
    };
    const onPopState = (e: PopStateEvent) => {
      if (sessionValidRef.current && !adCompletedRef.current) {
        invalidateSession("back button pressed");
      }
    };
    const onBeforeUnload = () => {
      sessionValidRef.current = false;
      sessionTokenRef.current = null;
    };
    // push a state so back button fires popstate first, doesn't leave the page
    try { history.pushState({ __ad: true }, ""); } catch { /* no-op */ }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [videoOpen, invalidateSession]);

  // Auto-claim once the ad genuinely completes
  const claimVideoReward = useCallback(async () => {
    if (claimInFlightRef.current) return;
    if (!sessionValidRef.current || !adCompletedRef.current) return;
    claimInFlightRef.current = true;
    setPhase("claiming");

    const heldMs = Date.now() - adStartAtRef.current;
    if (heldMs < MIN_AD_MS) {
      claimInFlightRef.current = false;
      invalidateSession("ad ended too fast");
      return;
    }
    // burn the token so it can't be reused
    sessionTokenRef.current = null;
    sessionValidRef.current = false;

    const { data, error } = await supabase.rpc("claim_popunder_view", { _hold_ms: Math.max(heldMs, HOLD_MS) });
    claimInFlightRef.current = false;

    if (error) {
      const msg = error.message || "Couldn't credit that view";
      if (/DAILY_LIMIT/i.test(msg)) toast.error("You've hit today's ad limit. Come back tomorrow!");
      else if (/HOLD_TOO_SHORT/i.test(msg)) toast.error("Ad ended too fast — try another.");
      else if (/TOO_FAST/i.test(msg)) toast.error("Slow down — wait a few seconds between views.");
      else toast.error(msg);
      teardownVideo();
      setPhase("idle");
      return;
    }
    const payload = data as any;
    setViewsToday(payload?.views_today ?? viewsToday + 1);
    toast.success(`+${payload?.credits_added ?? PER_VIEW} PC added!`);
    try { await refreshProfile(); } catch { /* no-op */ }
    teardownVideo();
    setPhase("idle");
  }, [invalidateSession, refreshProfile, teardownVideo, viewsToday]);

  const startVideoAd = async () => {
    if (capped || phase !== "idle") return;
    if (!videoRef.current || !fullscreenElRef.current) {
      toast.error("Video slot not ready — reload the page and try again.");
      return;
    }
    if (!fluidReady || !window.fluidPlayer) {
      toast.info("Ad player still loading — switching to Pop-under.");
      setMode("popunder");
      setTimeout(() => startPopunder(), 50);
      return;
    }

    // Fresh session
    sessionTokenRef.current = makeToken();
    sessionValidRef.current = true;
    adCompletedRef.current = false;
    adStartAtRef.current = Date.now();
    setFlagged(false);
    setVideoBooting(true);
    setVideoOpen(true);

    // Request fullscreen on the container (best-effort; browser may deny outside gesture)
    setTimeout(() => {
      try { fullscreenElRef.current?.requestFullscreen?.().catch(() => {}); } catch { /* no-op */ }
    }, 30);

    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }

    // Safety timer — if VAST never responds within 8s, fall back cleanly.
    const bootTimeout = window.setTimeout(() => setVideoBooting(false), 8000);

    try {
      const player = window.fluidPlayer(videoRef.current, {
        layoutControls: {
          primaryColor: "hsl(var(--primary))",
          fillToContainer: true,
          autoPlay: true,
          mute: false,
          allowDownload: false,
          playButtonShowing: false,
          playPauseAnimation: false,
          keyboardControl: false,
          doubleclickFullscreen: false,
          allowTheatre: false,
          controlBar: { autoHide: true, autoHideTimeout: 0.1, animated: false },
          logo: { imageUrl: null },
          contextMenu: { controls: false },
        },
        vastOptions: {
          adList: [
            {
              roll: "preRoll",
              vastTag: VAST_TAG_URL,
              adText: "",
            },
          ],
          adCTAText: false,
          adCTATextPosition: "bottom right",
          skipButtonCaption: "",
          skipButtonClickCaption: "",
          allowVPAID: true,
          showPlayButton: false,
          maxAllowedVastTagRedirects: 5,
          vastAdvanced: {
            vastLoadedCallback: () => {
              window.clearTimeout(bootTimeout);
              setVideoBooting(false);
              adStartAtRef.current = Date.now();
            },
            noVastVideoCallback: () => {
              window.clearTimeout(bootTimeout);
              setVideoBooting(false);
              toast.info("No video ad available — switching to Pop-under.");
              sessionValidRef.current = false;
              sessionTokenRef.current = null;
              teardownVideo();
              setPhase("idle");
              setMode("popunder");
              setTimeout(() => startPopunder(), 50);
            },
            vastVideoSkippedCallback: () => {
              // Skip should be disabled, but if the ad network forces it, no reward.
              invalidateSession("ad skipped");
            },
            vastVideoEndedCallback: () => {
              adCompletedRef.current = true;
              setVideoAdPlaying(false);
              // Auto-close + auto-claim
              void claimVideoReward();
            },
          },
        },
      });
      fluidInstanceRef.current = player;
      setVideoAdPlaying(true);
      setPhase("holding");

      // Harden the underlying <video> element against pause / seek / rate change.
      const vEl = videoRef.current;
      if (vEl) {
        vEl.removeAttribute("controls");
        vEl.setAttribute("disablepictureinpicture", "");
        vEl.setAttribute("controlslist", "nodownload noplaybackrate nofullscreen noremoteplayback");
        vEl.setAttribute("playsinline", "");
        vEl.addEventListener("contextmenu", (e) => e.preventDefault());
        // Prevent scrubbing
        let lastTime = 0;
        vEl.addEventListener("timeupdate", () => { lastTime = vEl.currentTime; });
        vEl.addEventListener("seeking", () => {
          if (Math.abs(vEl.currentTime - lastTime) > 0.75) {
            try { vEl.currentTime = lastTime; } catch { /* no-op */ }
          }
        });
        // Prevent pause mid-ad
        vEl.addEventListener("pause", () => {
          if (!adCompletedRef.current && sessionValidRef.current && !vEl.ended) {
            vEl.play().catch(() => {});
          }
        });
        vEl.addEventListener("ratechange", () => {
          if (vEl.playbackRate !== 1) vEl.playbackRate = 1;
        });
      }
    } catch (e: any) {
      window.clearTimeout(bootTimeout);
      setVideoBooting(false);
      toast.error("Couldn't start the video ad — switching to Pop-under.");
      sessionValidRef.current = false;
      teardownVideo();
      setPhase("idle");
      setMode("popunder");
      setTimeout(() => startPopunder(), 50);
    }
  };

  const startPopunder = () => {
    if (capped || phase !== "idle") return;
    setFlagged(false);
    clickTimeRef.current = Date.now();
    try {
      if (!document.querySelector(`script[src="${POPUNDER_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = POPUNDER_SRC;
        s.async = true;
        document.body.appendChild(s);
      }
    } catch { /* no-op */ }

    let opened = false;
    const onBlur = () => { opened = true; };
    window.addEventListener("blur", onBlur, { once: true });
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!opened) {
        try {
          const w = window.open(POPUNDER_SRC.replace(/\/[^/]+\.js$/, "/"), "_blank", "noopener,noreferrer");
          if (!w) toast.info("Popup blocked", { description: "Allow pop-ups for this site, then try again." });
          else toast.message("Ad opened", { description: "Come back in 20 seconds to claim your reward." });
        } catch {
          toast.info("Ad couldn't open", { description: "Please allow pop-ups and try again." });
        }
      } else {
        toast.message("Ad opened in a new tab", { description: "Come back in 20 seconds to claim your reward." });
      }
    }, 1200);

    setPhase("holding");
    setHoldRemaining(Math.ceil(HOLD_MS / 1000));
    const startedAt = Date.now();
    holdTimerRef.current = window.setInterval(() => {
      const left = Math.max(0, HOLD_MS - (Date.now() - startedAt));
      setHoldRemaining(Math.ceil(left / 1000));
      if (left <= 0) {
        if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setPhase("ready");
      }
    }, 250);
  };

  const claimPopunder = async () => {
    if (phase !== "ready") return;
    if (flagged) {
      toast.error("You returned too fast — that view didn't count. Try again.");
      setPhase("idle");
      return;
    }
    setPhase("claiming");
    const heldMs = Date.now() - clickTimeRef.current;
    const { data, error } = await supabase.rpc("claim_popunder_view", { _hold_ms: heldMs });
    if (error) {
      const msg = error.message || "Couldn't credit that view";
      if (/DAILY_LIMIT/i.test(msg)) toast.error("You've hit today's ad limit. Come back tomorrow!");
      else if (/HOLD_TOO_SHORT/i.test(msg)) toast.error("Hold a bit longer next time.");
      else if (/TOO_FAST/i.test(msg)) toast.error("Slow down — wait a few seconds between views.");
      else toast.error(msg);
      setPhase("idle");
      return;
    }
    const payload = data as any;
    setViewsToday(payload?.views_today ?? viewsToday + 1);
    toast.success(`+${payload?.credits_added ?? PER_VIEW} PC added!`);
    try { await refreshProfile(); } catch { /* no-op */ }
    setPhase("idle");
  };

  // Countdown to midnight reset.
  const [resetIn, setResetIn] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const s = Math.max(0, Math.floor((+midnight - +now) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      setResetIn(`${h}h ${m}m ${ss}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const progressPct = Math.min(100, (viewsToday / DAILY_CAP) * 100);

  const startLabel =
    mode === "video" ? "Watch Video Ad to Earn" : "Open Pop-under Ad to Earn";

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold font-display">Watch & Earn</h1>
          <p className="text-sm text-muted-foreground">Watch a quick ad, earn Plug Credits.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <Coins className="w-4 h-4" /> Balance: {Number(profile?.credits ?? 0).toFixed(3).replace(/\.?0+$/, "")} PC
            </div>
          )}
        </header>

        {/* Ad-format tabs — Video first */}
        <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => phase === "idle" && setMode("video")}
            disabled={phase !== "idle"}
            className={`h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${
              mode === "video" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            } ${phase !== "idle" ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <Video className="w-4 h-4" /> Video Ad
          </button>
          <button
            type="button"
            onClick={() => phase === "idle" && setMode("popunder")}
            disabled={phase !== "idle"}
            className={`h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition ${
              mode === "popunder" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            } ${phase !== "idle" ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <MousePointerClick className="w-4 h-4" /> Pop-under
          </button>
        </div>

        <div className="bg-card border rounded-3xl p-6 shadow-card space-y-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Per view</div>
              <div className="text-lg font-bold text-primary">{PER_VIEW} PC</div>
            </div>
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Watched</div>
              <div className="text-lg font-bold">{loading ? "…" : viewsToday}</div>
            </div>
            <div className="rounded-2xl bg-primary/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Remaining</div>
              <div className="text-lg font-bold">{loading ? "…" : remaining}</div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5 text-muted-foreground">
              <span>{viewsToday} of {DAILY_CAP} today</span>
              {capped && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Resets in {resetIn}</span>}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {mode === "video" && phase === "idle" && (
            <Button
              className="w-full h-12 text-base"
              disabled={capped || loading || !fluidReady}
              onClick={startVideoAd}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {capped ? "Daily limit reached" : !fluidReady ? "Loading ad player…" : startLabel}
            </Button>
          )}

          {mode === "video" && phase === "holding" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Ad playing…
            </Button>
          )}

          {mode === "video" && phase === "claiming" && (
            <Button className="w-full h-12 text-base" disabled>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crediting reward…
            </Button>
          )}

          {mode === "popunder" && phase === "idle" && (
            <Button
              className="w-full h-12 text-base"
              disabled={capped || loading}
              onClick={startPopunder}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {capped ? "Daily limit reached" : startLabel}
            </Button>
          )}

          {mode === "popunder" && phase === "holding" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Hold on… {holdRemaining}s
            </Button>
          )}

          {mode === "popunder" && phase === "ready" && (
            <Button className="w-full h-12 text-base" onClick={claimPopunder}>
              <ShieldCheck className="w-5 h-5 mr-2" /> Claim reward
            </Button>
          )}

          {mode === "popunder" && phase === "claiming" && (
            <Button className="w-full h-12 text-base" disabled>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crediting…
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Credits are written server-side. Skipping, leaving the tab, or tampering with
            the ad cancels the reward.
          </p>
        </div>

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to Earn credits</Link>
        </div>
      </div>

      {/* Full-screen ad overlay — mounted only while a video session is live */}
      <div
        ref={fullscreenElRef}
        className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center ${videoOpen ? "" : "hidden"}`}
        style={{ touchAction: "none" }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          <video
            ref={videoRef}
            id="sp-watch-earn-video"
            className="w-full h-full object-contain bg-black"
            playsInline
          />
          {videoBooting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ad…
            </div>
          )}
          {/* No close button — leaving mid-ad forfeits the reward via visibility/back handlers */}
          <div className="absolute top-3 left-3 text-[11px] uppercase tracking-wider text-white/70 bg-black/40 rounded px-2 py-1">
            Sponsored · reward on completion
          </div>
        </div>
      </div>
    </AppShell>
  );
}
