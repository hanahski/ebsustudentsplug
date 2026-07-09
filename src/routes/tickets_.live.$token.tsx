import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Users2, ScanLine, Sparkles, ShieldCheck, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Public read-only live view of a ticket's buyer roster + check-in status.
 * Anyone with the URL can watch sales roll in in realtime; the admin/uploader
 * can revoke the link at any time from the admin panel.
 */
export const Route = createFileRoute("/tickets_/live/$token")({
  head: () => ({
    meta: [
      { title: "Live ticket sales — StudentsPlug" },
      { name: "description", content: "Real-time view of ticket sales and check-ins." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LiveTicketView,
});

function LiveTicketView() {
  const { token } = Route.useParams();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-ticket-sales", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ticket_sales_by_token" as any, { _token: token });
      if (error) throw error;
      return data as any;
    },
    refetchInterval: 15_000,
  });

  // Realtime kick — as soon as anything changes on purchases/scans/shares,
  // re-run the RPC. We don't know the ticket id up front, so we listen broadly
  // and let the RPC filter server-side.
  useEffect(() => {
    const ch = supabase
      .channel(`public-ticket-live-${token}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_purchases" }, () => {
        qc.invalidateQueries({ queryKey: ["public-ticket-sales", token] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_share_links" }, () => {
        qc.invalidateQueries({ queryKey: ["public-ticket-sales", token] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, token]);

  if (isLoading) {
    return (
      <div className="min-h-dvh grid place-items-center p-6 text-muted-foreground">
        <div className="animate-pulse text-sm">Loading live view…</div>
      </div>
    );
  }

  if (isError || !data?.ok) {
    return (
      <div className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/15 text-destructive grid place-items-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold font-display">This live view is no longer available</h1>
          <p className="text-sm text-muted-foreground">
            The share link may have been revoked by the ticket owner, or the ticket was removed.
          </p>
          <Button asChild variant="outline"><Link to="/">Back to StudentsPlug</Link></Button>
        </div>
      </div>
    );
  }

  const t = data.ticket ?? {};
  const rows = (data.rows ?? []) as any[];
  const stats = data.stats ?? {};

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <Link to="/" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="w-3 h-3" /> StudentsPlug home
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/25 via-card to-card p-5 shadow-card-lg">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-pink-500/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold uppercase tracking-wider">
              <Radio className="w-3 h-3 animate-pulse" /> Live
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold font-display leading-tight">{t.title ?? "Ticket"}</h1>
            <p className="text-xs text-muted-foreground mt-1">Public read-only view · updates automatically</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-card/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Sold</div>
                <div className="text-2xl font-bold">{stats.sold ?? 0}</div>
              </div>
              <div className="rounded-2xl bg-card/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Checked in</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.used ?? 0}</div>
              </div>
              <div className="rounded-2xl bg-card/70 backdrop-blur border p-3 text-center">
                <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400">Revenue</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300 truncate">
                  {t.pay_mode === "credits"
                    ? `${Number(stats.revenue ?? 0).toLocaleString()} cr`
                    : `₦${Number(stats.revenue ?? 0).toLocaleString()}`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Roster */}
        <div className="rounded-2xl border bg-card overflow-hidden shadow-card">
          <div className="px-4 py-2.5 border-b bg-muted/30 text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <Users2 className="w-4 h-4" /> Buyers ({rows.length})
          </div>
          {rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Waiting for the first sale…
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((r: any) => (
                <li key={r.purchase_id} className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center text-xs font-bold shrink-0">
                    #{r.buyer_index ?? "-"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-1">{r.buyer_name ?? "Anonymous"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.purchased_at).toLocaleString()}
                    </p>
                  </div>
                  {r.used_at ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                      <ScanLine className="w-3 h-3" /> {new Date(r.used_at).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap">
                      Not used
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          Shared read-only view · The owner can revoke this link at any time · Powered by StudentsPlug
        </p>
      </div>
    </div>
  );
}
