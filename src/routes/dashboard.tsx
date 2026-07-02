import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, TrendingUp, Banknote, ShoppingCart, Landmark, ArrowRight, ShieldCheck, Plus } from "lucide-react";
import { CreditCoin } from "@/components/CreditCoin";
import { BankAccountResolver } from "@/components/BankAccountResolver";
import { BankCard } from "@/components/BankCard";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Credit Dashboard — StudentsPlug" }] }),
});

const CREDIT_TO_NAIRA = 2; // 1 credit = ₦2

function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const [resolved, setResolved] = useState<
    | { account_number: string; bank_code: string; bank_name: string; account_name: string }
    | null
  >(null);
  const [swapAmount, setSwapAmount] = useState(100);

  const payout = (profile as any)?.payout_account as
    | { bank_name?: string; bank_code?: string; account_number?: string; account_name?: string }
    | null;

  useEffect(() => {
    if (payoutOpen && payout?.account_name) {
      setResolved({
        account_number: payout.account_number ?? "",
        bank_code: payout.bank_code ?? "",
        bank_name: payout.bank_name ?? "",
        account_name: payout.account_name ?? "",
      });
    } else if (payoutOpen) {
      setResolved(null);
    }
  }, [payoutOpen]);

  const savePayout = async () => {
    if (!profile) return;
    if (!resolved?.account_name) return toast.error("Enter a valid account number");
    const { error } = await supabase
      .from("profiles")
      .update({
        payout_account: {
          bank_name: resolved.bank_name,
          bank_code: resolved.bank_code,
          account_number: resolved.account_number,
          account_name: resolved.account_name,
        },
      } as any)
      .eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Payout account saved");
    setPayoutOpen(false);
    refreshProfile();
  };

  const requestSwap = async () => {
    if (!profile) return;
    if (!payout?.account_number) return toast.error("Connect a payout account first");
    if (swapAmount < 100) return toast.error("Minimum swap is 100 credits");
    if ((profile.credits ?? 0) < swapAmount) return toast.error("Not enough credits");
    toast.success(`Payout of ₦${(swapAmount * CREDIT_TO_NAIRA).toLocaleString()} requested — you'll receive it within 24h.`);
    setSwapOpen(false);
  };

  if (loading || !profile) return <AppShell><div className="py-10 text-center text-muted-foreground">Loading…</div></AppShell>;

  const nairaValue = (profile.credits ?? 0) * CREDIT_TO_NAIRA;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-gradient-to-br from-primary via-primary/90 to-emerald-500 text-primary-foreground rounded-3xl p-6 shadow-glow relative overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="text-sm opacity-90">Your credits</div>
              <div className="text-5xl sm:text-6xl font-extrabold font-display mt-2 tracking-tight">
                {(profile.credits ?? 0).toLocaleString()}
              </div>
              <div className="text-sm opacity-90 mt-1">≈ ₦{nairaValue.toLocaleString()} · 1 credit = ₦{CREDIT_TO_NAIRA}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/earn-credits"><TrendingUp className="w-4 h-4 mr-1" />Earn more</Link>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setBuyOpen(true)}>
                  <ShoppingCart className="w-4 h-4 mr-1" />Buy credits
                </Button>
              </div>
            </div>
            <div className="shrink-0 flex items-center justify-center pr-1 sm:pr-3">
              <CreditCoin size={124} spin className="drop-shadow-2xl" />
            </div>
          </div>
        </section>

        {payout?.account_number ? (
          <BankCard
            bankName={payout.bank_name ?? ""}
            accountName={payout.account_name ?? ""}
            accountNumber={payout.account_number ?? ""}
            onEdit={() => setPayoutOpen(true)}
          />
        ) : (
          <button
            onClick={() => setPayoutOpen(true)}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-left transition hover:border-primary hover:bg-primary/10"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold">Connect payout account</div>
                <div className="text-xs text-muted-foreground">Get paid in naira — verified through Paystack</div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard
            icon={TrendingUp}
            title="Earn more credits"
            desc="Tasks, games & tournaments"
            tone="from-emerald-500 to-teal-600"
            to="/earn-credits"
          />
          <ActionCard
            icon={ShoppingCart}
            title="Buy credits"
            desc="Top up instantly with card"
            tone="from-sky-500 to-indigo-600"
            onClick={() => setBuyOpen(true)}
          />
          <ActionCard
            icon={Banknote}
            title="Swap credits to cash"
            desc={`${CREDIT_TO_NAIRA}₦ per credit · min 100`}
            tone="from-fuchsia-500 to-rose-600"
            onClick={() => setSwapOpen(true)}
          />
          <ActionCard
            icon={Landmark}
            title={payout?.account_number ? "Change payout bank" : "Payout details"}
            desc={payout?.account_number ? "Update your bank account" : "Add before requesting cash"}
            tone="from-amber-500 to-orange-600"
            onClick={() => setPayoutOpen(true)}
          />
        </div>

        <div className="text-center">
          <Link to="/me" className="text-xs text-muted-foreground hover:text-primary">← Back to profile</Link>
        </div>
      </div>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" /> Payout account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <BankAccountResolver
              value={payout ?? undefined}
              onResolved={(r) => setResolved(r)}
            />
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified through Paystack — we never store your card or PIN.
            </div>
            <Button onClick={savePayout} className="w-full" disabled={!resolved?.account_name}>
              Save payout account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Swap credits to cash</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Credits to swap</Label>
              <Input type="number" min={100} value={swapAmount} onChange={(e) => setSwapAmount(Number(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">You'll receive ₦{(swapAmount * CREDIT_TO_NAIRA).toLocaleString()}</p>
            </div>
            {!payout?.account_number && (
              <p className="text-xs text-amber-600">Connect a payout account first.</p>
            )}
            <Button onClick={requestSwap} className="w-full" disabled={!payout?.account_number}>
              Request payout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buy credits</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[100, 500, 1000, 5000].map((amt) => (
              <button key={amt} className="w-full flex items-center justify-between border rounded-2xl p-4 hover:border-primary hover:bg-primary/5 transition"
                onClick={() => toast.info("Payment integration coming soon — contact support to top up.")}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 text-white flex items-center justify-center">
                    <CreditCoin size={26} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{amt.toLocaleString()} credits</div>
                    <div className="text-xs text-muted-foreground">₦{(amt * CREDIT_TO_NAIRA).toLocaleString()}</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ActionCard({ icon: Icon, title, desc, tone, to, onClick }: { icon: any; title: string; desc: string; tone: string; to?: string; onClick?: () => void }) {
  const body = (
    <div className="bg-card border rounded-2xl p-4 shadow-card hover:-translate-y-0.5 hover:shadow-lg transition text-left w-full h-full">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center mb-3 shadow`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-bold">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
  if (to) return <Link to={to}>{body}</Link>;
  return <button onClick={onClick} className="text-left">{body}</button>;
}
