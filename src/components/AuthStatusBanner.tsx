import { useAuth } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export function AuthStatusBanner() {
  const { user, error, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(true);

  const raw = error?.message ?? "";
  const isAuthError = /unauthorized|no authorization header|invalid token|no user id found|jwt|not authenticated/i.test(raw);

  // Auto-hide any shown banner after 2s.
  useEffect(() => {
    setVisible(true);
    if (!error) return;
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [error?.message, user?.id]);

  if (pathname !== "/") return null;
  if (!visible) return null;

  // Signed-out: no banner.
  if (!user && (!error || isAuthError)) return null;
  // Signed in: the user has a live session, so "session expired" is a lie —
  // suppress auth-error banners entirely for signed-in users. Stale errors
  // from the initial getSession() call before the token refresh completed
  // used to spam this banner even though the refresh succeeded.
  if (user) return null;
  // Ignore benign permission errors (e.g. has_role) — don't nag the user.
  if (/permission denied/i.test(raw)) return null;

  const baseClasses =
    "fixed inset-x-0 top-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium backdrop-blur-sm";

  return (
    <div className={`${baseClasses} bg-destructive/90 text-destructive-foreground`}>
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Auth error: {raw}</span>
      </div>
    </div>
  );
}
