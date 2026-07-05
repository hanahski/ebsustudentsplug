import { useAuth } from "@/lib/auth";
import { useRouterState } from "@tanstack/react-router";
import { LogOut, User, AlertCircle } from "lucide-react";

export function AuthStatusBanner() {
  const { user, error, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Only ever shown on the home page.
  if (pathname !== "/") return null;

  const raw = error?.message ?? "";
  const isAuthError = /unauthorized|no authorization header|invalid token|no user id found|jwt|not authenticated/i.test(raw);

  // Signed-out state: no banner at all (the header already offers Sign in).
  if (!user && (!error || isAuthError)) return null;

  const baseClasses =
    "fixed inset-x-0 top-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium backdrop-blur-sm transition-transform duration-500 ease-out translate-y-0";

  // Signed-in but token was rejected: quiet nudge to re-auth.
  if (user && error && isAuthError) {
    return (
      <div className={`${baseClasses} bg-muted/90 text-muted-foreground border-b border-border`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Your session expired. Sign in again to continue.</span>
        </div>
        <button
          onClick={async () => { await signOut(); window.location.href = "/login"; }}
          className="shrink-0 rounded bg-foreground/10 px-2 py-0.5 text-[11px] hover:bg-foreground/20"
        >
          Sign in again
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${baseClasses} bg-destructive/90 text-destructive-foreground`}>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Auth error: {raw}</span>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded bg-destructive-foreground/20 px-2 py-0.5 text-[11px] hover:bg-destructive-foreground/30"
        >
          Retry
        </button>
      </div>
    );
  }

  // Signed in, no error: hide (slide up).
  return (
    <div className={`${baseClasses} bg-success/90 text-success-foreground -translate-y-full`}>
      <div className="flex items-center gap-2">
        <User className="h-3.5 w-3.5 shrink-0" />
        <span>
          Signed in as <span className="font-semibold">{user!.email ?? user!.id.slice(0, 8)}</span>
        </span>
      </div>
      <button
        onClick={() => signOut()}
        className="shrink-0 inline-flex items-center gap-1 rounded bg-success-foreground/20 px-2 py-0.5 text-[11px] hover:bg-success-foreground/30"
      >
        <LogOut className="h-3 w-3" />
        Sign out
      </button>
    </div>
  );
}
