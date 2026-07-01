import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const TASK_LIBRARY: Record<string, { id: string; title: string; desc: string }[]> = {
  "10": [
    { id: "share-post", title: "Share a post to your feed", desc: "Pick any post and tap Share." },
    { id: "comment-3", title: "Leave 3 helpful comments", desc: "Comment on 3 different posts." },
    { id: "invite-1", title: "Invite 1 friend (they must open)", desc: "Send your referral link." },
    { id: "profile-photo", title: "Upload a profile photo", desc: "Complete your profile." },
  ],
  "20": [
    { id: "publish-note", title: "Publish a study note", desc: "Share notes with your department." },
    { id: "review-book", title: "Review a book you've read", desc: "Post a 2-line review." },
    { id: "answer-5", title: "Answer 5 questions in Q&A", desc: "Help other students out." },
    { id: "watch-2ads", title: "Watch 2 sponsored clips", desc: "Short partner videos." },
  ],
  "50": [
    { id: "post-article", title: "Publish a full article", desc: "300+ words on a topic you know." },
    { id: "sell-item", title: "List a product on Market Plug", desc: "First listing this week." },
    { id: "refer-3", title: "Refer 3 friends who sign up", desc: "They must verify." },
    { id: "complete-quiz", title: "Complete a study quiz", desc: "Score 80%+." },
  ],
};

function TasksPage() {
  const { amount } = Route.useParams();
  const nav = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [claiming, setClaiming] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => { if (!user) nav({ to: "/login" }); }, [user]);

  const tasks = TASK_LIBRARY[amount] ?? [];
  const reward = Number(amount) || 0;

  const claim = async (taskId: string) => {
    if (!user) return;
    setClaiming(taskId);
    const { data, error } = await supabase.rpc("claim_ad_reward", { _amount: reward });
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
          <p className="text-sm text-muted-foreground">Complete any task below to earn <b>{amount} credits</b>.</p>
          {user && (
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/10 rounded-full px-3 py-1">
              <Coins className="w-4 h-4" /> Balance: {profile?.credits ?? 0}
            </div>
          )}
        </header>

        <div className="space-y-3">
          {tasks.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10 border rounded-2xl">
              No tasks for this amount yet.
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
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">+{amount}</span>
                </div>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant={isDone ? "outline" : "default"}
                  disabled={isDone || claiming === t.id}
                  onClick={() => claim(t.id)}
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
