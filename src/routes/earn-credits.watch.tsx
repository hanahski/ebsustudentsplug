import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Coins, PlayCircle, Loader2, Clock, X } from "lucide-react";

export const Route = createFileRoute("/earn-credits/watch")({
  component: WatchEarnPage,
  head: () => ({ meta: [{ title: "Watch & Earn — StudentsPlug" }] }),
});

const PER_VIEW = 0.1;
const DAILY_CAP = 15;
const HOLD_MS = 20_000;
const VAST_TAG_URL = "https://youradexchange.com/video/select.php?r=11575442";
const FLUID_PLAYER_SRC = "https://cdn.fluidplayer.com/v3/current/fluidplayer.min.js";
const MIN_AD_MS = 5_000;

type Phase = "idle" | "checking" | "playing" | "claiming";

declare global {
  interface Window {
    fluidPlayer?: (id: string | HTMLVideoElement, opts?: any) => any;
  }
}

/** Fetch the VAST tag and return true if it contains at least one playable Ad. */
async function checkVastAvailable(url: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { method: "GET", signal: ctrl.signal, mode: "cors", credentials: "omit" });
    clearTimeout(t);
    if (!res.ok) return false;
    const text = await res.text();
    // Real VAST responses contain <Ad ...> with an <InLine> or <Wrapper>.
    // An empty <VAST> shell (no <Ad>) means no fill.
    if (!/<Ad[\s>]/i.test(text)) return false;
    if (!/<InLine[\s>]|<Wrapper[\s>]/i.test(text)) return false;
    return true;
  } catch {
    // CORS block or network error — assume maybe-available and let Fluid Player try.
    return true;
  }
}

function WatchEarnPage() {
  const nav = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [viewsToday, setViewsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fluidInstanceRef = useRef<any>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [videoBooting, setVideoBooting] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  const sessionValidRef = useRef<boolean>(false);
  const adStartAtRef = useRef<number>(0);
  const adCompletedRef = useRef<boolean>(false);
  const claimInFlightRef = useRef<boolean>(false);

  useEffect(() => { if (user === null) nav({ to: "/login" }); }, [user, nav]);

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

  const remaining = Math.max(0, DAILY_CAP - viewsToday);
  const capped = remaining <= 0;

  const teardownVideo = useCallback(() => {
    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }
    fluidInstanceRef.current = null;
    setVideoBooting(false);
    setVideoOpen(false);
  }, []);

  const invalidateSession = useCallback((reason: string) => {
    if (!sessionValidRef.current) return;
    sessionValidRef.current = false;
    adCompletedRef.current = false;
    toast.error(`Ad view cancelled: ${reason}. No reward earned.`);
    teardownVideo();
    setPhase("idle");
  }, [teardownVideo]);

  useEffect(() => () => { teardownVideo(); }, [teardownVideo]);

  // Anti-tamper listeners while ad session is live
  useEffect(() => {
    if (!videoOpen) return;
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && sessionValidRef.current && !adCompletedRef.current) {
        invalidateSession("you left the ad");
      }
    };
    const onPopState = () => {
      if (sessionValidRef.current && !adCompletedRef.current) {
        invalidateSession("back button pressed");
      }
    };
    try { history.pushState({ __ad: true }, ""); } catch { /* no-op */ }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("popstate", onPopState);
    };
  }, [videoOpen, invalidateSession]);

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

  const bootPlayer = useCallback(() => {
    if (!videoRef.current || !window.fluidPlayer) return;
    try { fluidInstanceRef.current?.destroy?.(); } catch { /* no-op */ }

    const bootTimeout = window.setTimeout(() => {
      // If VAST never responds, treat as no-fill.
      if (!sessionValidRef.current || adCompletedRef.current) return;
      sessionValidRef.current = false;
      teardownVideo();
      setPhase("idle");
      toast.info("No ad available now — try again in a bit.");
    }, 8000);

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
          adList: [{ roll: "preRoll", vastTag: VAST_TAG_URL, adText: "" }],
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
              sessionValidRef.current = false;
              teardownVideo();
              setPhase("idle");
              toast.info("No ad available now — try again in a bit.");
            },
            vastVideoSkippedCallback: () => {
              window.clearTimeout(bootTimeout);
              invalidateSession("ad skipped");
            },
            vastVideoEndedCallback: () => {
              adCompletedRef.current = true;
              void claimVideoReward();
            },
          },
        },
      });
      fluidInstanceRef.current = player;

      const vEl = videoRef.current;
      if (vEl) {
        vEl.removeAttribute("controls");
        vEl.setAttribute("disablepictureinpicture", "");
        vEl.setAttribute("controlslist", "nodownload noplaybackrate nofullscreen noremoteplayback");
        vEl.setAttribute("playsinline", "");
        vEl.addEventListener("contextmenu", (e) => e.preventDefault());
        let lastTime = 0;
        vEl.addEventListener("timeupdate", () => { lastTime = vEl.currentTime; });
        vEl.addEventListener("seeking", () => {
          if (Math.abs(vEl.currentTime - lastTime) > 0.75) {
            try { vEl.currentTime = lastTime; } catch { /* no-op */ }
          }
        });
        vEl.addEventListener("pause", () => {
          if (!adCompletedRef.current && sessionValidRef.current && !vEl.ended) {
            vEl.play().catch(() => {});
          }
        });
        vEl.addEventListener("ratechange", () => {
          if (vEl.playbackRate !== 1) vEl.playbackRate = 1;
        });
      }
    } catch {
      window.clearTimeout(bootTimeout);
      sessionValidRef.current = false;
      teardownVideo();
      setPhase("idle");
      toast.error("Couldn't start the ad — try again.");
    }
  }, [claimVideoReward, invalidateSession, teardownVideo]);

  const startVideoAd = async () => {
    if (capped || phase !== "idle") return;
    if (!fluidReady || !window.fluidPlayer) {
      toast.info("Ad player still loading — try again in a moment.");
      return;
    }

    // Step 1: check availability BEFORE opening the overlay
    setPhase("checking");
    const available = await checkVastAvailable(VAST_TAG_URL);
    if (!available) {
      setPhase("idle");
      toast.info("No ad available now — try again in a bit.");
      return;
    }

    // Step 2: open overlay & boot the player (no fullscreen; covers the page)
    sessionValidRef.current = true;
    adCompletedRef.current = false;
    adStartAtRef.current = Date.now();
    setVideoBooting(true);
    setVideoOpen(true);
    setPhase("playing");

    // Wait a tick for the <video> to mount
    setTimeout(() => bootPlayer(), 30);
  };

  const cancelAd = () => {
    if (adCompletedRef.current) return;
    invalidateSession("closed by you");
  };

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

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold font-display">Watch & Earn</h1>
          <p className="text-sm text-muted-foreground">Watch a quick video ad, earn Plug Credits.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <Coins className="w-4 h-4" /> Balance: {Number(profile?.credits ?? 0).toFixed(3).replace(/\.?0+$/, "")} PC
            </div>
          )}
        </header>

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

          {phase === "idle" && (
            <Button
              className="w-full h-12 text-base"
              disabled={capped || loading || !fluidReady}
              onClick={startVideoAd}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {capped ? "Daily limit reached" : !fluidReady ? "Loading ad player…" : "Watch Video Ad to Earn"}
            </Button>
          )}

          {phase === "checking" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Checking for an ad…
            </Button>
          )}

          {phase === "playing" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Ad playing…
            </Button>
          )}

          {phase === "claiming" && (
            <Button className="w-full h-12 text-base" disabled>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Crediting reward…
            </Button>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Credits are written server-side. Skipping, leaving the tab, or tampering with the ad cancels the reward.
          </p>
        </div>

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to Earn credits</Link>
        </div>
      </div>

      {/* Page-covering ad overlay (not OS fullscreen) — only mounted while a session is live */}
      {videoOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
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
            <div className="absolute top-3 left-3 text-[11px] uppercase tracking-wider text-white/70 bg-black/40 rounded px-2 py-1">
              Sponsored · reward on completion
            </div>
            {videoBooting && (
              <button
                type="button"
                onClick={cancelAd}
                aria-label="Close"
                className="absolute top-3 right-3 text-white/80 hover:text-white bg-black/40 rounded-full p-1.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
