import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export const PENDING_REFERRAL_KEY = "studentsplug:pending-referral";

type Pending = { code: string; inviter_name?: string; at?: number };

export function readPendingReferral(): Pending | null {
  try {
    const raw = localStorage.getItem(PENDING_REFERRAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code) return null;
    return parsed as Pending;
  } catch { return null; }
}

export function clearPendingReferral() {
  try { localStorage.removeItem(PENDING_REFERRAL_KEY); } catch {}
}

/**
 * Compact FOMO banner shown on the login page (and anywhere pre-signup)
 * when the visitor arrived via an invite link. Animated shimmer + pulse
 * to nudge signups without feeling spammy.
 */
export function InviteFomoBanner({ onDismiss }: { onDismiss?: () => void }) {
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => { setPending(readPendingReferral()); }, []);
  if (!pending) return null;
  const name = pending.inviter_name?.trim() || "A friend";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-fuchsia-500/10 to-amber-500/10 p-3 pr-9 mb-4">
      <div className="pointer-events-none absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/20 blur-2xl animate-pulse" aria-hidden />
      <div className="flex items-start gap-2.5 relative">
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-snug">
            <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent animate-fomo-shimmer">
              {name}
            </span>{" "}
            invited you — sign up, claim your reward and start earning.
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 animate-fomo-flash">
            Limited-time welcome bonus • +50 credits on your first account
          </div>
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => { clearPendingReferral(); onDismiss(); }}
          className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/60"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
