import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Coins, PlayCircle, Loader2, ShieldCheck, Clock, Video, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/earn-credits/watch")({
  component: WatchEarnPage,
  head: () => ({ meta: [{ title: "Watch & Earn — StudentsPlug" }] }),
});

const PER_VIEW = 0.1; // Plug Credits per view
const DAILY_CAP = 15;
const HOLD_MS = 20_000;      // 20s minimum hold before claim allowed
const FAST_RETURN_MS = 5_000; // <5s focus return = suspicious
const POPUNDER_SRC =
  "https://pl30191443.effectivecpmnetwork.com/42/2e/9c/422e9c1120d4e5695c47b9c2d592ca75.js";
const VAST_TAG_URL = "https://youradexchange.com/video/select.php?r=11575442";
const FLUID_PLAYER_SRC = "https://cdn.fluidplayer.com/v3/current/fluidplayer.min.js";

type Phase = "idle" | "holding" | "ready" | "claiming";
type Mode = "video" | "popunder";

declare global {
  interface Window {
    fluidPlayer?: (id: string | HTMLVideoElement, opts?: any) => any;
  }
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
  const [videoBooting, setVideoBooting] = useState(false);
  const [videoAdPlaying, setVideoAdPlaying] = useState(false);

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

  // Cleanup Fluid Player when switching mode / unmounting.
  useEffect(() => {
    return () => {
      try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
      fluidInstanceRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (mode !== "video") {
      try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
      fluidInstanceRef.current = null;
      setVideoAdPlaying(false);
    }
  }, [mode]);

  const startVideoAd = () => {
    if (capped || phase !== "idle") return;
    if (!videoRef.current) {
      toast.error("Video slot not ready — reload the page and try again.");
      return;
    }
    if (!fluidReady || !window.fluidPlayer) {
      toast.info("Ad player still loading — switching to Pop-under.");
      setMode("popunder");
      // give React a tick to swap the UI, then start pop-under
      setTimeout(() => startPopunder(), 50);
      return;
    }
    setFlagged(false);
    setVideoBooting(true);
    clickTimeRef.current = Date.now();

    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }

    // Safety timer — if VAST never responds within 8s, fall back cleanly.
    const bootTimeout = window.setTimeout(() => {
      if (phase === "holding" || videoBooting) {
        // ad kept us hanging — give the user the credit path anyway
        setVideoBooting(false);
      }
    }, 8000);

    try {
      const player = window.fluidPlayer(videoRef.current, {
        layoutControls: {
          primaryColor: "hsl(var(--primary))",
          fillToContainer: true,
          autoPlay: true,
          mute: false,
          allowDownload: false,
          playButtonShowing: true,
          playPauseAnimation: true,
          controlBar: { autoHide: true, autoHideTimeout: 3, animated: true },
          logo: { imageUrl: null },
        },
        vastOptions: {
          adList: [
            {
              roll: "preRoll",
              vastTag: VAST_TAG_URL,
              adText: "Sponsored — watch to earn",
            },
          ],
          adCTAText: false,
          adCTATextPosition: "bottom right",
          skipButtonCaption: "Skip in [seconds]",
          skipButtonClickCaption: "Skip Ad ▶",
          allowVPAID: true,
          showPlayButton: true,
          maxAllowedVastTagRedirects: 5,
          vastAdvanced: {
            vastLoadedCallback: () => {
              window.clearTimeout(bootTimeout);
              setVideoBooting(false);
            },
            noVastVideoCallback: () => {
              window.clearTimeout(bootTimeout);
              setVideoBooting(false);
              toast.info("No video ad available — switching to Pop-under.");
              try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
              fluidInstanceRef.current = null;
              setPhase("idle");
              setMode("popunder");
              setTimeout(() => startPopunder(), 50);
            },
            vastVideoSkippedCallback: () => {
              // Skipped ads still count toward hold.
            },
            vastVideoEndedCallback: () => {
              setVideoAdPlaying(false);
              setPhase("ready");
            },
          },
        },
      });
      fluidInstanceRef.current = player;
      setVideoAdPlaying(true);

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
    } catch (e: any) {
      window.clearTimeout(bootTimeout);
      setVideoBooting(false);
      toast.error("Couldn't start the video ad — switching to Pop-under.");
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

  const claim = async () => {
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
    setVideoAdPlaying(false);
    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
    fluidInstanceRef.current = null;
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

  const startCurrent = () => (mode === "video" ? startVideoAd() : startPopunder());
  const startLabel =
    mode === "video" ? "Play Video Ad to Earn" : "Open Pop-under Ad to Earn";

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

          {/* Video player — only rendered in video mode */}
          {mode === "video" && (
            <div className="rounded-2xl overflow-hidden border bg-black aspect-video relative">
              <video
                ref={videoRef}
                id="sp-watch-earn-video"
                className="w-full h-full"
                playsInline
                controls
              >
                {/* Empty source — Fluid Player fills preRoll VAST ad */}
              </video>
              {!videoAdPlaying && !videoBooting && phase === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 pointer-events-none">
                  <Video className="w-10 h-10 mb-2 opacity-80" />
                  <div className="text-sm">Tap "Play Video Ad" below</div>
                </div>
              )}
              {videoBooting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ad…
                </div>
              )}
            </div>
          )}

          {phase === "idle" && (
            <Button
              className="w-full h-12 text-base"
              disabled={capped || loading || (mode === "video" && !fluidReady)}
              onClick={startCurrent}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {capped ? "Daily limit reached" : startLabel}
            </Button>
          )}

          {phase === "holding" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {mode === "video" ? `Watching… ${holdRemaining}s` : `Hold on… ${holdRemaining}s`}
            </Button>
          )}

          {phase === "ready" && (
            <Button className="w-full h-12 text-base" onClick={claim}>
              <ShieldCheck className="w-5 h-5 mr-2" /> Claim reward
            </Button>
          )}

          {phase === "claiming" && (
            <Button className="w-full h-12 text-base" disabled>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crediting…
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Credits are written server-side. Skipping the video, returning too fast, or spamming
            clicks won't count.
          </p>
        </div>

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to Earn credits</Link>
        </div>
      </div>
    </AppShell>
  );
}
