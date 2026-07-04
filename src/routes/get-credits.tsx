import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ArrowRight, Loader2 } from "lucide-react";
import { CreditCoin } from "@/components/CreditCoin";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPC } from "@/lib/plug-credits";

export const Route = createFileRoute("/get-credits")({
  component: GetCreditsPage,
  head: () => ({ meta: [{ title: "Get Plug Credits — StudentsPlug" }] }),
});

// Cosmetic gradient rotation for buckets — no hard-coded amounts, admin
// can add any bucket in the Task Composer and it appears here automatically.
const GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-fuchsia-600",
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
  "from-rose-500 to-red-600",
  "from-lime-500 to-emerald-600",
];

function GetCreditsPage() {
  const { user, profile } = useAuth();
  const { data: buckets, isLoading } = useQuery({
    queryKey: ["task-buckets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("bucket")
        .eq("is_active", true)
        .order("bucket");
      if (error) throw error;
      const uniq = Array.from(new Set((data ?? []).map((r: any) => Number(r.bucket)))).sort((a, b) => a - b);
      return uniq;
    },
  });

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-2">
          <div className="mx-auto"><CreditCoin size={64} spin /></div>
          <h1 className="text-2xl font-bold font-display">Get more Plug Credits</h1>
          <p className="text-sm text-muted-foreground">Pick how many Plug Credits you want. We'll show you the tasks that reward that amount.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <CreditCoin size={16} /> Balance: {formatPC(profile?.credits, { withLabel: true, short: true })}
            </div>
          )}
        </header>

        {isLoading ? (
          <div className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
        ) : (buckets ?? []).length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground border rounded-2xl bg-card">
            No task buckets available yet. Check back soon!
          </div>
        ) : (
          <div className="space-y-3">
            {(buckets ?? []).map((amount, i) => (
              <Link
                key={amount}
                to="/tasks/$amount"
                params={{ amount: String(amount) }}
                className="w-full text-left bg-card border rounded-2xl p-4 shadow-card flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-center justify-center text-white shrink-0 shadow`}>
                  <CreditCoin size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{amount} PC bucket</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Tasks that reward around {amount} Plug Credits.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        )}

        <div className="text-center">
          <Link to="/earn-credits" className="text-xs text-muted-foreground hover:text-primary">← Back to Earn Plug Credits</Link>
        </div>
      </div>
    </AppShell>
  );
}
