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

// Credit economy — 3 credits = ₦1 when withdrawing, ₦1 buys 2 credits when topping up.
const CREDITS_PER_NAIRA_SELL = 3; // 3 credits redeem to ₦1
const NAIRA_PER_CREDIT_SELL = 1 / CREDITS_PER_NAIRA_SELL; // ≈ ₦0.333
const CREDITS_PER_NAIRA_BUY = 2; // ₦1 buys 2 credits
const WITHDRAWAL_FEE_PCT = 0.10;
const WITHDRAWAL_FEE_FLAT = 150;
const MIN_SWAP_CREDITS = 900; // ~₦300 gross, so payout is meaningful after fees

const BUY_PACKAGES: Array<{ naira: number; credits: number; label?: string }> = [
  { naira: 1150, credits: 2300, label: "Starter" },
  { naira: 2300, credits: 4600, label: "Popular" },
  { naira: 5750, credits: 11500, label: "Value" },
  { naira: 11500, credits: 23000, label: "Pro" },
  { naira: 17250, credits: 34500, label: "Mega" },
];

function computeWithdrawal(credits: number) {
  const gross = credits * NAIRA_PER_CREDIT_SELL;
  const fee = gross * WITHDRAWAL_FEE_PCT + WITHDRAWAL_FEE_FLAT;
  const net = Math.max(0, gross - fee);
  return { gross, fee, net };
}

function DashboardPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);
  // Credits are stored as numeric in Postgres, which PostgREST returns as a
  // string. Coerce to a real number so math/formatting always work.
  const creditBalance = Number(profile?.credits ?? 0) || 0;
  // Refresh once on mount so freshly-granted welcome credits / rewards land
  // even if the realtime UPDATE fired before this page subscribed.
  useEffect(() => { if (user) refreshProfile(); }, [user?.id]);


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
    if (swapAmount < MIN_SWAP_CREDITS) return toast.error(`Minimum swap is ${MIN_SWAP_CREDITS.toLocaleString()} credits`);
    if (creditBalance < swapAmount) return toast.error("Not enough credits");
    const { net } = computeWithdrawal(swapAmount);
    if (net <= 0) return toast.error("Amount too low after the withdrawal fee");
    toast.success(`Payout of ₦${net.toLocaleString(undefined, { maximumFractionDigits: 2 })} requested — you'll receive it within 24h.`);
    setSwapOpen(false);
  };

  if (loading || !profile) return <AppShell><div className="py-10 text-center text-muted-foreground">Loading…</div></AppShell>;

  const nairaValue = creditBalance * NAIRA_PER_CREDIT_SELL;
  const swapPreview = computeWithdrawal(swapAmount);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-gradient-to-br from-primary via-primary/90 to-emerald-500 text-primary-foreground rounded-3xl p-6 shadow-glow relative overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4">
            <div>
              <div className="text-sm opacity-90">Your credits</div>
              <div className="text-5xl sm:text-6xl font-extrabold font-display mt-2 tracking-tight">
                {creditBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm opacity-90 mt-1">
                Cash value ≈ ₦{nairaValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                Every 3 credits = ₦1 when you cash out
              </div>
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
            desc={`₦1 buys ${CREDITS_PER_NAIRA_BUY} credits`}
            tone="from-sky-500 to-indigo-600"
            onClick={() => setBuyOpen(true)}
          />
          <ActionCard
            icon={Banknote}
            title="Swap credits to cash"
            desc={`Turn credits into naira · 3 credits = ₦1 · minimum ${MIN_SWAP_CREDITS.toLocaleString()} credits`}
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

        <div className="rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
          <div className="font-semibold text-foreground text-sm">How credits & naira work</div>
          <div>• <span className="font-semibold text-foreground">Buying credits:</span> pay ₦1, get {CREDITS_PER_NAIRA_BUY} credits (₦0.50 per credit)</div>
          <div>• <span className="font-semibold text-foreground">Cashing out:</span> every 3 credits become ₦1 (about ₦0.33 per credit)</div>
          <div>• <span className="font-semibold text-foreground">Minimum cash-out:</span> {MIN_SWAP_CREDITS.toLocaleString()} credits</div>
          <div>• <span className="font-semibold text-foreground">Withdrawal fee:</span> 10% of the amount + ₦150 flat</div>
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
              <Input type="number" min={MIN_SWAP_CREDITS} value={swapAmount} onChange={(e) => setSwapAmount(Number(e.target.value) || 0)} />
              <div className="mt-2 rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
                <Row label="Gross (3 credits = ₦1)" value={`₦${swapPreview.gross.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                <Row label="Fee (10% + ₦150)" value={`− ₦${swapPreview.fee.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
                <div className="border-t pt-1 flex items-center justify-between font-semibold text-foreground">
                  <span>You receive</span>
                  <span>₦{swapPreview.net.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            {!payout?.account_number && (
              <p className="text-xs text-amber-600">Connect a payout account first.</p>
            )}
            <Button onClick={requestSwap} className="w-full" disabled={!payout?.account_number || swapPreview.net <= 0}>
              Request payout <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Buy credits</DialogTitle></DialogHeader>
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground">₦1 = {CREDITS_PER_NAIRA_BUY} credits. Pick a package below.</p>
            {BUY_PACKAGES.map((pkg) => (
              <button key={pkg.naira} className="w-full flex items-center justify-between border rounded-2xl p-4 hover:border-primary hover:bg-primary/5 transition"
                onClick={() => toast.info("Payment integration coming soon — contact support to top up.")}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 text-white flex items-center justify-center">
                    <CreditCoin size={26} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold flex items-center gap-2">
                      {pkg.credits.toLocaleString()} credits
                      {pkg.label && <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary rounded-full px-2 py-0.5">{pkg.label}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">₦{pkg.naira.toLocaleString()}</div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
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
