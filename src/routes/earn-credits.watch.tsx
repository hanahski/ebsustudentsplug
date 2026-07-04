import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Coins, PlayCircle, Loader2, ShieldCheck, Clock } from "lucide-react";

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

type Phase = "idle" | "holding" | "ready" | "claiming";

function WatchEarnPage() {
  const nav = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [viewsToday, setViewsToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [holdRemaining, setHoldRemaining] = useState(0);
  const [flagged, setFlagged] = useState(false);
  const clickTimeRef = useRef<number>(0);
  const holdTimerRef = useRef<number | null>(null);

  useEffect(() => { if (user === null) nav({ to: "/login" }); }, [user, nav]);

  // Preload the Adsterra popunder script ONCE on mount. Popunder networks
  // hook their own click listener at load time — injecting the script inside
  // the click handler loses the user-gesture context and the popup is silently
  // blocked. Preloading gives the first tap a real chance to open a tab.
  const popunderReady = useRef(false);
  useEffect(() => {
    if (popunderReady.current) return;
    try {
      const existing = document.querySelector(`script[src="${POPUNDER_SRC}"]`);
      if (!existing) {
        const s = document.createElement("script");
        s.src = POPUNDER_SRC;
        s.async = true;
        document.body.appendChild(s);
      }
      popunderReady.current = true;
    } catch { /* no-op */ }
  }, []);

  // Load today's view count from credit_transactions.
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

  // Detect suspiciously fast return to the tab.
  useEffect(() => {
    const onFocus = () => {
      if (phase !== "holding") return;
      const elapsed = Date.now() - clickTimeRef.current;
      if (elapsed < FAST_RETURN_MS) setFlagged(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [phase]);

  const remaining = Math.max(0, DAILY_CAP - viewsToday);
  const capped = remaining <= 0;

  const startWatch = () => {
    if (capped || phase !== "idle") return;
    setFlagged(false);
    clickTimeRef.current = Date.now();

    // Ensure the popunder script is loaded (idempotent).
    try {
      if (!document.querySelector(`script[src="${POPUNDER_SRC}"]`)) {
        const s = document.createElement("script");
        s.src = POPUNDER_SRC;
        s.async = true;
        document.body.appendChild(s);
      }
    } catch { /* no-op */ }

    // Fallback: some browsers/ad-blockers silently swallow the popunder.
    // Track whether the tab loses focus within 1200ms; if not, open a
    // fallback ad tab manually so the reward flow can still complete.
    let opened = false;
    const onBlur = () => { opened = true; };
    window.addEventListener("blur", onBlur, { once: true });
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!opened) {
        try {
          const w = window.open(POPUNDER_SRC.replace(/\/[^/]+\.js$/, "/"), "_blank", "noopener,noreferrer");
          if (!w) {
            toast.info("Popup blocked", {
              description: "Allow pop-ups for this site so the ad can open, then try again.",
            });
          } else {
            toast.message("Ad opened", { description: "Come back in 20 seconds to claim your reward." });
          }
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
              disabled={capped || loading}
              onClick={startWatch}
            >
              <PlayCircle className="w-5 h-5 mr-2" />
              {capped ? "Daily limit reached" : "Watch Ad to Earn Coin"}
            </Button>
          )}

          {phase === "holding" && (
            <Button className="w-full h-12 text-base" disabled variant="outline">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Hold on… {holdRemaining}s
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
            Credits are written server-side. Returning to this tab too quickly, or spamming clicks,
            won't count.
          </p>
        </div>

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to Earn credits</Link>
        </div>
      </div>
    </AppShell>
  );
}
