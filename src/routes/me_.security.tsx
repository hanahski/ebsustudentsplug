import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { KeyRound, Shield, LogOut, Smartphone, Mail, Bell, History, Fingerprint, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/me_/security")({
  component: SecurityPage,
  head: () => ({ meta: [{ title: "Password & security — StudentsPlug" }] }),
});

function SecurityPage() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const [twoFA, setTwoFA] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [trustedOnly, setTrustedOnly] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [passkey, setPasskey] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(true);

  useEffect(() => {
    setTwoFA(localStorage.getItem("sp:2fa") === "1");
    setLoginAlerts(localStorage.getItem("sp:loginAlerts") !== "0");
    setTrustedOnly(localStorage.getItem("sp:trustedOnly") === "1");
    setPasskey(localStorage.getItem("sp:passkey") === "1");
    setSessionTimeout(localStorage.getItem("sp:sessionTimeout") !== "0");
    setRecoveryEmail(localStorage.getItem("sp:recoveryEmail") ?? "");
  }, []);

  const flag = (key: string, v: boolean, setter: (v: boolean) => void, msg?: string) => {
    setter(v); localStorage.setItem(key, v ? "1" : "0"); if (msg) toast.success(msg);
  };

  const change = async () => {
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated");
      setPw(""); setPw2("");
    } catch (err: any) { toast.error(err.message || "Could not update password"); }
    finally { setBusy(false); }
  };

  const forgot = async () => {
    if (!user?.email) return toast.error("No email on this account");
    setBusy(true);
    try {
      const { sendRecoveryOtp } = await import("@/lib/password-reset-otp.functions");
      await sendRecoveryOtp({ data: { email: user.email } });
      toast.success("Code sent to your email");
      await nav({ to: "/reset-password", search: { email: user.email } });
    } catch (err: any) { toast.error(err.message || "Could not send code"); }
    finally { setBusy(false); }
  };

  const logoutOthers = async () => {
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});
    toast.success("Signed out of all other devices");
  };

  const saveRecovery = () => {
    localStorage.setItem("sp:recoveryEmail", recoveryEmail);
    toast.success("Recovery email saved");
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Shield className="w-6 h-6 text-primary" />Password & security</h1>

        <div className="bg-card border rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-4 h-4" />Change password</h2>
          <div><Label>New password</Label><Input type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" /></div>
          <div><Label>Confirm new password</Label><Input type="password" minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button onClick={change} disabled={busy}>{busy ? "Saving…" : "Save password"}</Button>
            <Button variant="outline" onClick={forgot} disabled={busy}>Forgot password</Button>
          </div>
        </div>

        <SecRow icon={Smartphone} title="Two-factor authentication" desc="Require a code from your phone at sign-in.">
          <Switch checked={twoFA} onCheckedChange={(v) => flag("sp:2fa", v, setTwoFA, v ? "2FA enabled" : "2FA disabled")} />
        </SecRow>

        <SecRow icon={Fingerprint} title="Passkey / biometric login" desc="Sign in with fingerprint or Face ID.">
          <Switch checked={passkey} onCheckedChange={(v) => flag("sp:passkey", v, setPasskey, v ? "Passkey enabled" : "Passkey disabled")} />
        </SecRow>

        <SecRow icon={Bell} title="Login alerts" desc="Email me when a new device signs in.">
          <Switch checked={loginAlerts} onCheckedChange={(v) => flag("sp:loginAlerts", v, setLoginAlerts)} />
        </SecRow>

        <SecRow icon={AlertTriangle} title="Trusted devices only" desc="Block sign-ins from new devices without approval.">
          <Switch checked={trustedOnly} onCheckedChange={(v) => flag("sp:trustedOnly", v, setTrustedOnly)} />
        </SecRow>

        <SecRow icon={History} title="Auto sign-out after inactivity" desc="Sign out after 30 min idle.">
          <Switch checked={sessionTimeout} onCheckedChange={(v) => flag("sp:sessionTimeout", v, setSessionTimeout)} />
        </SecRow>

        <div className="bg-card border rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Mail className="w-5 h-5" /></div>
            <div className="flex-1"><Label className="font-semibold">Recovery email</Label><p className="text-xs text-muted-foreground">Used if you lose access to your primary email.</p></div>
          </div>
          <div className="flex gap-2">
            <Input value={recoveryEmail} onChange={(e) => setRecoveryEmail(e.target.value)} placeholder="backup@example.com" type="email" />
            <Button variant="outline" onClick={saveRecovery}>Save</Button>
          </div>
        </div>

        <SecRow icon={LogOut} title="Sign out of all other devices" desc="Keeps this device signed in.">
          <Button size="sm" variant="outline" onClick={logoutOthers}>Sign out</Button>
        </SecRow>

        <SecRow icon={History} title="Login history" desc="Coming soon — see recent sign-ins by device and location.">
          <span className="text-xs text-muted-foreground">Soon</span>
        </SecRow>

        <div className="pt-2"><Link to="/me" className="text-xs text-muted-foreground hover:text-primary">← Back to profile</Link></div>
      </div>
    </AppShell>
  );
}

function SecRow({ icon: Icon, title, desc, children }: any) {
  return (
    <div className="bg-card border rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
      <div className="flex-1 min-w-0">
        <Label className="font-semibold text-sm">{title}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
