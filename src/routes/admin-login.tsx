import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getIsAdminUser } from "@/lib/admin-role";

export const Route = createFileRoute("/admin-login")({
  component: AdminLogin,
  head: () => ({
    meta: [
      { title: "Staff sign-in — StudentsPlug" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in and admin, forward straight to /admin.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const isAdmin = await getIsAdminUser(data.user.id).catch(() => false);
      if (isAdmin) nav({ to: "/admin" });
    })();
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Sign-in failed");
      return;
    }
    // Auto-claim admin role for the seeded staff emails.
    try { await (supabase.rpc as any)("claim_seed_admin_role"); } catch { /* no-op */ }
    const isAdmin = await getIsAdminUser(data.user.id).catch(() => false);
    setLoading(false);
    if (!isAdmin) {
      toast.error("This account is not a staff account.");
      await supabase.auth.signOut();
      return;
    }
    toast.success("Welcome back, staff.");
    nav({ to: "/admin" });
  };

  return (
    <AppShell>
      <div className="max-w-sm mx-auto py-10">
        <form onSubmit={submit} className="bg-card border rounded-3xl shadow-card p-6 space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo size={56} />
            <h1 className="text-xl font-bold font-display inline-flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Staff sign-in
            </h1>
            <p className="text-xs text-muted-foreground">Restricted area — admin credentials only.</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Email</label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold">Password</label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
            Sign in to admin
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
