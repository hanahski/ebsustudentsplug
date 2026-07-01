import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Target } from "lucide-react";

export const Route = createFileRoute("/earn-credits/prediction")({ component: () => (
  <AppShell>
    <div className="max-w-lg mx-auto text-center py-16 space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-rose-600 text-white flex items-center justify-center mx-auto"><Target className="w-7 h-7" /></div>
      <h1 className="text-2xl font-bold font-display">Prediction Challenge</h1>
      <p className="text-sm text-muted-foreground">Daily prediction challenges launch soon. Test your instincts and win credits.</p>
      <Link to="/earn-credits" className="text-xs text-primary">← Back</Link>
    </div>
  </AppShell>
) });
