import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CheckSquare, Gamepad2, Trophy, Target } from "lucide-react";

export const Route = createFileRoute("/earn-credits")({
  component: EarnCreditsPage,
  head: () => ({ meta: [{ title: "Earn credits — StudentsPlug" }] }),
});

const TILES = [
  { key: "tasks", label: "Tasks", icon: CheckSquare, cta: "Complete tasks to earn credits", tone: "from-emerald-500 to-teal-600", to: "/get-credits" as const },
  { key: "games", label: "Games", icon: Gamepad2, cta: "Play games, win credits", tone: "from-sky-500 to-indigo-600", to: "/games" as const },
  { key: "tournament", label: "Tournament", icon: Trophy, cta: "Compete for prize pools", tone: "from-amber-500 to-orange-600", to: "/earn-credits/tournament" as const },
  { key: "prediction", label: "Prediction Challenge", icon: Target, cta: "Predict outcomes, win big", tone: "from-fuchsia-500 to-rose-600", to: "/earn-credits/prediction" as const },
];

function EarnCreditsPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display">Earn credits</h1>
          <p className="text-sm text-muted-foreground">Pick a way to earn — tap any card to start.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TILES.map((t) => (
            <Link key={t.key} to={t.to} className="bg-card border rounded-2xl p-5 shadow-card hover:-translate-y-0.5 hover:shadow-lg transition">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.tone} text-white flex items-center justify-center mb-3 shadow`}>
                <t.icon className="w-6 h-6" />
              </div>
              <div className="font-bold">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t.cta}</div>
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link to="/dashboard" className="text-xs text-muted-foreground hover:text-primary">← Back to dashboard</Link>
        </div>
      </div>
    </AppShell>
  );
}
