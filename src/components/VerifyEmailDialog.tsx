import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { MailCheck, Loader2 } from "lucide-react";
import { sendVerifyOtp, verifyEmailOtp } from "@/lib/email-otp.functions";

const OPEN_EVENT = "studentsplug:open-verify-email";

export function openVerifyEmailDialog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/** Convenience: catch a thrown error from a buy/spend call and, if it's the
 *  EMAIL_NOT_VERIFIED sentinel, open the dialog. Returns true if handled. */
export function handleEmailNotVerified(err: unknown): boolean {
  const msg = String((err as { message?: string } | null)?.message ?? err ?? "");
  if (msg.includes("EMAIL_NOT_VERIFIED")) {
    toast.error("Please verify your email to continue.");
    openVerifyEmailDialog();
    return true;
  }
  return false;
}

export function VerifyEmailDialog() {
  const { user, profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"send" | "code">("send");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onOpen = () => {
      if (!user) {
        toast.error("Sign in first.");
        return;
      }
      if (profile?.email_verified) {
        toast.success("Your email is already verified.");
        return;
      }
      setStage("send");
      setCode("");
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [user, profile?.email_verified]);

  const email = user?.email ?? "";

  const sendCode = async () => {
    if (!email) return;
    setBusy(true);
    try {
      await sendVerifyOtp();
      toast.success(`Code sent to ${email}`, { description: "Can't see it? Check your Spam folder — mark it 'Not spam' so future codes inbox." });
      setStage("code");
    } catch (err: any) {
      toast.error(err.message || "Couldn't send code");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!email || code.trim().length < 6) return;
    setBusy(true);
    try {
      await verifyEmailOtp({ data: { code: code.trim() } });
      await refreshProfile();
      toast.success("Email verified! You can buy now.");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <MailCheck className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Verify your email</DialogTitle>
          <DialogDescription className="text-center">
            You need to verify your email before you can buy books, tickets, or use paid features.
          </DialogDescription>
        </DialogHeader>

        {stage === "send" ? (
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={email} disabled />
            </div>
            <Button onClick={sendCode} disabled={busy || !email} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send 6-digit code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp-code">Enter the 6-digit code sent to {email}</Label>
              <Input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-xl tracking-[0.4em] font-mono"
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              <p className="font-semibold mb-1">📬 Can't find the email?</p>
              <p><b>Check your Spam / Junk folder</b> — the first email from us often lands there.</p>
              <p className="mt-1">If it's in spam: tap <b>"Not spam"</b> and <b>add the sender to your contacts</b>. All future codes will go straight to your inbox.</p>
            </div>

            <Button onClick={verify} disabled={busy || code.length < 6} className="w-full">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify email"}
            </Button>
            <button
              type="button"
              className="text-xs text-primary hover:underline w-full text-center"
              onClick={sendCode}
              disabled={busy}
            >
              Resend code
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
