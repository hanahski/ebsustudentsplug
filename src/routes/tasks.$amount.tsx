import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Coins, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/tasks/$amount")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "Tasks — StudentsPlug" }] }),
});

function TasksPage() {
  const { amount } = Route.useParams();
  const nav = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => { if (!user) nav({ to: "/login" }); }, [user]);

  const bucket = Number(amount) || 0;

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", bucket],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,reward_credits,sort_order")
        .eq("bucket", bucket)
        .eq("is_active", true)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const claim = async (taskId: string, reward: number) => {
    if (!user) return;
    setClaiming(taskId);
    const { error } = await supabase.rpc("claim_ad_reward", { _amount: reward });
    setClaiming(null);
    if (error) {
      const msg = error.message || "Couldn't grant credits";
      toast.error(/DAILY_LIMIT/i.test(msg) ? "You've hit today's reward limit. Come back tomorrow!" : msg);
      return;
    }
    toast.success(`+${reward} credits added!`);
    setDone((s) => new Set(s).add(taskId));
    try { await refreshProfile(); } catch {}
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto space-y-6">
        <header className="text-center space-y-1">
          <h1 className="text-2xl font-bold font-display">{amount}-credit tasks</h1>
          <p className="text-sm text-muted-foreground">Complete any task below to earn credits.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <Coins className="w-4 h-4" /> Balance: {profile?.credits ?? 0}
            </div>
          )}
        </header>

        <div className="space-y-3">
          {isLoading && (
            <div className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
          )}
          {!isLoading && tasks.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10 border rounded-2xl">
              No tasks available for this amount yet. Check back soon!
            </div>
          )}
          {tasks.map((t) => {
            const isDone = done.has(t.id);
            return (
              <div key={t.id} className="bg-card border rounded-2xl p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{t.title}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">+{t.reward_credits}</span>
                </div>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant={isDone ? "outline" : "default"}
                  disabled={isDone || claiming === t.id}
                  onClick={() => claim(t.id, t.reward_credits)}
                >
                  {claiming === t.id ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" />Claiming…</>) :
                   isDone ? (<><CheckCircle2 className="w-4 h-4 mr-1" />Claimed</>) :
                   "Mark done & claim"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <Link to="/get-credits" className="text-xs text-muted-foreground hover:text-primary">← Pick a different amount</Link>
        </div>
      </div>
    </AppShell>
  );
}
