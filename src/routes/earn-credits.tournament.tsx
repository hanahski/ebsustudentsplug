import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/earn-credits/tournament")({ component: () => (
  <AppShell>
    <div className="max-w-lg mx-auto text-center py-16 space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center mx-auto"><Trophy className="w-7 h-7" /></div>
      <h1 className="text-2xl font-bold font-display">Tournaments</h1>
      <p className="text-sm text-muted-foreground">Weekly tournaments launch soon. Compete with friends for big credit prizes.</p>
      <Link to="/earn-credits" className="text-xs text-primary">← Back</Link>
    </div>
  </AppShell>
) });
