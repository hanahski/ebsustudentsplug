import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { Sparkles, Gift, Zap, ArrowRight } from "lucide-react";
import brandLogo from "@/assets/brand-logo.png";

export const PENDING_REFERRAL_KEY = "studentsplug:pending-referral";

export const Route = createFileRoute("/i/$code")({
  component: InviteLanding,
  head: () => ({
    meta: [
      { title: "You've been invited to StudentsPlug" },
      { name: "description", content: "Your friend just invited you to StudentsPlug — join, claim your welcome credits, and start earning." },
      { property: "og:title", content: "You've been invited to StudentsPlug" },
      { property: "og:description", content: "Join, claim your welcome credits, and start earning on the plug." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function InviteLanding() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const normalized = code.trim().toUpperCase();

  const { data: inviter, isLoading } = useQuery({
    queryKey: ["inviter-lookup", normalized],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_key,rank_tier,is_verified")
        .eq("referral_code", normalized)
        .maybeSingle();
      return data;
    },
  });

  // Stash the code so login/verify-otp can auto-redeem after signup.
  useEffect(() => {
    if (!inviter) return;
    try {
      localStorage.setItem(
        PENDING_REFERRAL_KEY,
        JSON.stringify({ code: normalized, inviter_name: inviter.display_name, at: Date.now() }),
      );
    } catch {}
  }, [inviter, normalized]);

  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const goSignup = () => nav({ to: "/login", search: { redirect: "/" } as any });

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-accent/20 to-background">
      {/* animated glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/25 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative max-w-lg mx-auto px-4 py-10 sm:py-16">
        <Link to="/" className="inline-flex items-center font-bold text-lg text-gradient font-display">
          <img src={brandLogo} alt="S" className="h-9 w-9 object-contain -mr-1" />
          <span className="leading-none tracking-tight">tudentsPlug</span>
        </Link>

        <div className="mt-8 bg-card border rounded-3xl shadow-card p-6 sm:p-8 relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Personal invite
          </div>

          {isLoading ? (
            <div className="mt-6 text-center text-muted-foreground text-sm">Looking up your invite…</div>
          ) : !inviter ? (
            <>
              <h1 className="mt-4 text-2xl sm:text-3xl font-black font-display leading-tight">
                This invite link isn't valid
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ask your friend for a fresh link, or join StudentsPlug directly.
              </p>
              <Button className="mt-6 w-full" onClick={goSignup}>Join StudentsPlug</Button>
            </>
          ) : (
            <>
              <div className="mt-5 flex items-center gap-4">
                <AvatarDisplay avatarKey={inviter.avatar_key} size={64} className="ring-2 ring-primary/40" />
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Invited by</div>
                  <div className="font-bold text-lg truncate flex items-center gap-1.5">
                    {inviter.display_name}
                    {inviter.is_verified && <span className="text-primary text-xs">✓</span>}
                  </div>
                </div>
              </div>

              <h1 className="mt-6 text-2xl sm:text-3xl font-black font-display leading-[1.1]">
                <span className="bg-gradient-to-r from-primary via-fuchsia-500 to-amber-500 bg-clip-text text-transparent animate-fomo-shimmer">
                  {inviter.display_name}
                </span>{" "}
                invited you.
                <br />
                Sign up, claim your reward and start earning.
              </h1>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <RewardChip icon={Gift} label="+50 credits" tone="from-emerald-500 to-teal-600" />
                <RewardChip icon={Zap} label="Instant access" tone="from-amber-500 to-orange-600" />
                <RewardChip icon={Sparkles} label="Earn daily" tone="from-fuchsia-500 to-pink-600" />
              </div>

              <div className="mt-6 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Limited-time bonus.</span>{" "}
                <span className="animate-fomo-flash text-primary font-semibold">
                  Others are joining right now — don't miss out.
                </span>
              </div>

              {session ? (
                <div className="mt-6 text-sm text-center text-muted-foreground">
                  You're already signed in. Invite links only apply to brand-new accounts.
                  <div className="mt-3">
                    <Link to="/" className="text-primary font-semibold hover:underline">Go home →</Link>
                  </div>
                </div>
              ) : (
                <Button className="mt-6 w-full h-12 text-base font-bold" onClick={goSignup}>
                  Claim my reward <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}

              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Only counts if you create your account through this link.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RewardChip({ icon: Icon, label, tone }: { icon: any; label: string; tone: string }) {
  return (
    <div className={`rounded-xl p-2.5 text-center bg-gradient-to-br ${tone} text-white shadow-lg`}>
      <Icon className="w-4 h-4 mx-auto mb-1" />
      <div className="text-[11px] font-bold leading-tight">{label}</div>
    </div>
  );
}
