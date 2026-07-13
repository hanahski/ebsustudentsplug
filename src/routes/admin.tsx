import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shield } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getAdminRedirectUrl, goToAdminPanel } from "@/lib/admin-redirect";

export const Route = createFileRoute("/admin")({
  component: AdminRedirectPage,
  head: () => ({
    meta: [
      { title: "Opening admin — StudentsPlug" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminRedirectPage() {
  const target = getAdminRedirectUrl();

  useEffect(() => {
    const timer = window.setTimeout(goToAdminPanel, 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-sm py-16 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h1 className="font-display text-2xl font-bold">Opening admin panel</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirecting you now.</p>
        <Button type="button" onClick={goToAdminPanel} className="mt-5">
          Continue
        </Button>
        <p className="mt-3 break-all text-[11px] text-muted-foreground">{target}</p>
      </div>
    </AppShell>
  );
}