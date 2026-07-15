import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { sendRecoveryOtp, resetPasswordWithOtp } from "@/lib/password-reset-otp.functions";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: (s.email as string | undefined) ?? "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email: emailParam } = Route.useSearch();
  const nav = useNavigate();
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const resend = async () => {
    if (!email) return toast.error("Enter your email first");
    setBusy(true);
    try {
      await sendRecoveryOtp({ data: { email: email.trim() } });
      toast.success("New code sent. Check your inbox.");
      setResendIn(45);
    } catch (err: any) {
      toast.error(err.message || "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email");
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await resetPasswordWithOtp({ data: { email: email.trim(), code, password: pw } });
      // Sign in with the new password.
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });
      if (signErr) throw signErr;
      toast.success("Password updated");
      await nav({ to: "/" });
    } catch (err: any) {
      toast.error(err.message || "Could not update password");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background via-accent/30 to-background">
      <div className="w-full max-w-md bg-card border rounded-3xl shadow-card p-6 md:p-8">
        <Link to="/" className="font-bold text-xl text-gradient font-display">StudentsPlug</Link>
        <h1 className="mt-4 text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email || "your email"}</span>. Enter it below and choose a new password.
        </p>

        <form onSubmit={submit} className="space-y-4 mt-6">
          {!emailParam && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Verification code</Label>
            <div className="mt-2 flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode} disabled={busy}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>

          <div>
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" minLength={6} required value={pw} onChange={(e) => setPw(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm new password</Label>
            <Input id="pw2" type="password" minLength={6} required value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={resend}
              disabled={busy || resendIn > 0}
              className="text-primary font-semibold disabled:text-muted-foreground disabled:no-underline hover:underline"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
            <Link to="/login" className="text-muted-foreground hover:text-foreground hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
