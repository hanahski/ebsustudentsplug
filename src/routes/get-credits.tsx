import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Coins, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/get-credits")({
  component: GetCreditsPage,
  head: () => ({ meta: [{ title: "Get credits — StudentsPlug" }] }),
});

const OPTIONS = [
  { amount: 10, label: "Quick", gradient: "from-emerald-500 to-teal-600", desc: "Bite-size tasks — under 2 min" },
  { amount: 20, label: "Popular", gradient: "from-violet-500 to-fuchsia-600", desc: "Short tasks — under 5 min" },
  { amount: 50, label: "Best value", gradient: "from-amber-500 to-orange-600", desc: "Bigger tasks — 5–10 min" },
];

function GetCreditsPage() {
  const { user, profile } = useAuth();
  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center mx-auto">
            <Coins className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display">Get more credits</h1>
          <p className="text-sm text-muted-foreground">Pick how many credits you want. We'll show you the tasks that reward that amount.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <Coins className="w-4 h-4" /> Balance: {profile?.credits ?? 0}
            </div>
          )}
        </header>

        <div className="space-y-3">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.amount}
              to="/tasks/$amount"
              params={{ amount: String(opt.amount) }}
              className="w-full text-left bg-card border rounded-2xl p-4 shadow-card flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center text-white shrink-0 shadow`}>
                <Coins className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">{opt.amount} credits</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-muted text-muted-foreground rounded-full px-2 py-0.5">{opt.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to earn credits</Link>
        </div>
      </div>
    </AppShell>
  );
}
