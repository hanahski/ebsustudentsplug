import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Copy, Share2, Users, Coins, Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/me/invites")({ component: InvitesPage });

function InvitesPage() {
  const { user, profile, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const { data: myCode } = useQuery({
    queryKey: ["my-referral", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("referral_code").eq("id", profile!.id).maybeSingle();
      return (data?.referral_code as string | null) ?? null;
    },
  });

  const { data: invited } = useQuery({
    queryKey: ["my-invites", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("invitee_id, created_at, profiles:invitee_id(display_name, avatar_key)")
        .eq("inviter_id", profile!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = useMemo(() => (myCode ? `${origin}/i/${myCode}` : ""), [origin, myCode]);
  const count = invited?.length ?? 0;
  const earned = count * 100;

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };
  const share = async () => {
    if (!link) return;
    const text = `Join me on StudentsPlug and claim +50 credits: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Join StudentsPlug", text, url: link }); return; } catch {}
    }
    copy();
  };

  if (loading || !profile) return <AppShell><div className="max-w-2xl mx-auto py-10 text-center text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/me" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to profile
        </Link>

        <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 shadow-card">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Invite friends
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-black font-display leading-tight bg-gradient-to-br from-foreground via-primary to-fuchsia-500 bg-clip-text text-transparent">
              Share your link. Earn together.
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              You get <span className="text-foreground font-bold">+100 credits</span> for each friend who joins.
              They get <span className="text-foreground font-bold">+50 credits</span> the moment they sign up through your link.
            </p>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <Input readOnly value={link || "Generating…"} className="font-mono text-xs sm:text-sm" onFocus={(e) => e.currentTarget.select()} />
              <div className="flex gap-2">
                <Button onClick={copy} className="flex-1 sm:flex-none"><Copy className="w-4 h-4 mr-1" />{copied ? "Copied" : "Copy"}</Button>
                <Button onClick={share} variant="secondary" className="flex-1 sm:flex-none"><Share2 className="w-4 h-4 mr-1" />Share</Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">
              Only signups through <span className="font-semibold text-foreground">your link</span> count as invites.
              A shared code no longer works — links are the professional way.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <StatCard icon={Users} label="Friends invited" value={count} tone="from-sky-500 to-blue-600" />
          <StatCard icon={Coins} label="Credits earned" value={earned} tone="from-amber-500 to-orange-600" />
        </section>

        <section className="bg-card border rounded-3xl shadow-card p-5 sm:p-6">
          <h2 className="font-bold font-display text-lg flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-primary" /> Your invites
          </h2>
          {count === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No invites yet. Share your link on WhatsApp, X, or your class group chat.
            </div>
          ) : (
            <ul className="divide-y">
              {invited!.map((r: any) => (
                <li key={r.invitee_id} className="py-3 flex items-center gap-3">
                  <AvatarDisplay avatarKey={r.profiles?.avatar_key ?? "boy-1"} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{r.profiles?.display_name ?? "New student"}</div>
                    <div className="text-xs text-muted-foreground">Joined {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+100</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <div className="relative overflow-hidden bg-card border rounded-2xl p-4 shadow-card">
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${tone} opacity-20 blur-2xl`} aria-hidden />
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-lg`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
