import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { BrandLoader } from "@/components/BrandLoader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift } from "lucide-react";

type Phase = "idle" | "splash" | "dialog";

/**
 * First-time sign-in experience:
 *   1. Extended branded splash (logo + wordmark) for ~3.5s
 *   2. Navigates to /me (profile)
 *   3. Welcome bonus dialog highlighting the +50 credits gift
 */
export function WelcomeExperience() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (!user || !profile) return;
    if (phase !== "idle") return;
    let pending = false;
    try { pending = localStorage.getItem("sp:welcome-pending") === "1"; } catch {}
    if (!pending) return;
    setPhase("splash");
    const t = window.setTimeout(async () => {
      await nav({ to: "/me" }).catch(() => {});
      setPhase("dialog");
    }, 3500);
    return () => window.clearTimeout(t);
  }, [user, profile, phase, nav]);

  const close = () => {
    try { localStorage.removeItem("sp:welcome-pending"); } catch {}
    setPhase("idle");
  };

  if (phase === "splash") return <BrandLoader label="StudentsPlug" />;

  if (phase === "dialog") {
    const name = profile?.display_name || "there";
    return (
      <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Gift className="h-7 w-7" />
            </div>
            <DialogTitle className="text-2xl">Welcome, {name}!</DialogTitle>
            <DialogDescription className="text-base">
              Your profile is ready. As a joining gift, we've added
              <span className="mx-1 inline-flex items-center gap-1 font-semibold text-primary">
                <Sparkles className="h-4 w-4" /> 50 credits
              </span>
              to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Use credits to unlock premium tools, boost listings, or swap to cash from your Dashboard.
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={close} className="w-full sm:w-auto">Start exploring</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
