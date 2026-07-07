import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Ticket as TicketIcon, ShoppingCart, CheckCircle2, Download, Loader2 } from "lucide-react";
import { composeTicketImage, downloadTicketPdf, ticketFilename } from "@/lib/ticket-composer";

export const Route = createFileRoute("/tickets/$id")({ component: TicketDetail });

function TicketDetail() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [composed, setComposed] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const { data: t, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => (await supabase.from("tickets").select("*, uploader:profiles!tickets_uploader_id_fkey(display_name)").eq("id", id).maybeSingle()).data,
  });

  const composeAndDownload = async (ticket: any, buyerIndex: number | undefined, qrToken: string, openedWindow?: Window | null) => {
    if (!qrToken) throw new Error("Ticket QR is not ready yet");
    const stampedTicket = await composeTicketImage({
      photoUrl: ticket.photo_url,
      qrToken,
      title: ticket.title,
      holder: profile?.display_name || user?.email || "Holder",
      buyerIndex,
    });
    setComposed(stampedTicket);
    await downloadTicketPdf(stampedTicket, ticketFilename(ticket.title, buyerIndex), openedWindow);
  };

  const downloadOwnedTicket = async () => {
    const pdfWindow = window.open("", "_blank");
    try {
      // Pull the latest purchase for this user + ticket for filename numbering
      const { data: myPurchases } = await supabase
        .from("ticket_purchases")
        .select("buyer_index, qr_token")
        .eq("ticket_id", id)
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const latest = myPurchases?.[0];
      await composeAndDownload(t, latest?.buyer_index ?? undefined, latest?.qr_token ?? t?.qr_token ?? "", pdfWindow);
      toast.success("Ticket PDF downloaded");
    } catch (err: any) {
      pdfWindow?.close();
      toast.error(err.message ?? "PDF download failed");
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (t?.qr_token && t?.buyer_id === user?.id && !composed && !composing) {
      setComposing(true);
      composeTicketImage({
        photoUrl: t.photo_url,
        qrToken: t.qr_token,
        title: t.title,
        holder: profile?.display_name || user?.email || "Holder",
      })
        .then(async (url) => {
          if (cancelled) return;
          setComposed(url);
        })
        .catch(() => { if (!cancelled) toast.error("Couldn't render ticket"); })
        .finally(() => { if (!cancelled) setComposing(false); });
    }
    return () => { cancelled = true; };
  }, [t, user, profile, composed, composing]);

  const buy = async () => {
    if (!user) { nav({ to: "/login" }); return; }
    const pdfWindow = window.open("", "_blank");
    setBusy(true);
    const { data: buyRes, error } = await supabase.rpc("buy_ticket", { _ticket_id: id });
    if (error) {
      pdfWindow?.close();
      setBusy(false);
      return toast.error(error.message);
    }
    const buyerIndex = (buyRes as any)?.buyer_index as number | undefined;
    const qrToken = (buyRes as any)?.qr_token as string | undefined;
    toast.success(`Ticket purchased! You're buyer #${buyerIndex ?? "—"}. Downloading PDF…`);
    try {
      await composeAndDownload(t, buyerIndex, qrToken ?? "", pdfWindow);
      toast.success("Ticket PDF downloaded");
    } catch {
      pdfWindow?.close();
      toast.error("PDF download failed — use the download button below");
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["ticket", id] });
    }
  };

  if (isLoading) return <AppShell><p>Loading…</p></AppShell>;
  if (!t) return <AppShell><p>Not found.</p></AppShell>;

  const ownsIt = t.buyer_id === user?.id;

  return (
    <AppShell>
      <div className="space-y-4 max-w-xl mx-auto">
        <Link to="/tickets" className="text-xs text-primary inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />All tickets</Link>
        <div className="bg-card border rounded-3xl overflow-hidden shadow-card">
          <img src={t.photo_url} alt={t.title} className="w-full h-72 object-cover" />
          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold font-display">{t.title}</h1>
              <span className="text-primary font-bold text-xl whitespace-nowrap">
                {t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</p>
            <p className="text-xs text-muted-foreground">Sold by {(t as any).uploader?.display_name ?? "—"}</p>

            {ownsIt && (
              <div className="bg-success/10 border border-success/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-center gap-2 font-bold text-success"><CheckCircle2 className="w-5 h-5" />You own this ticket</div>
                {composing && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-6"><Loader2 className="w-4 h-4 animate-spin" />Stamping your QR onto the ticket…</div>
                )}
                {composed && (
                  <>
                    <img src={composed} alt="Your QR ticket" className="w-full rounded-xl border" />
                    <Button onClick={downloadOwnedTicket} className="w-full">
                      <Download className="w-4 h-4 mr-1" />Download ticket PDF (with QR)
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">Validate at the gate using the Ticket QR Scanner.</p>
                  </>
                )}
              </div>
            )}
            {t.pay_mode === "contact" ? (
              <>
                <Button onClick={buy} disabled={busy} className="w-full"><TicketIcon className="w-4 h-4 mr-1" />{busy ? "Downloading PDF…" : ownsIt ? "Buy another copy & download PDF" : "Reserve & download QR ticket PDF"}</Button>
                {t.contact && <p className="text-xs text-center text-muted-foreground">Then pay seller via: <strong>{t.contact}</strong></p>}
              </>
            ) : (
              <Button onClick={buy} disabled={busy} className="w-full"><ShoppingCart className="w-4 h-4 mr-1" />{busy ? "Downloading PDF…" : ownsIt ? `Buy another for ${t.price} cr` : `Buy with ${t.price} credits & download PDF`}</Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
