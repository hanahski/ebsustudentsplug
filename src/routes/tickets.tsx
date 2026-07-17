import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { encodePlugShare } from "@/components/PlugShareActions";
import { toast } from "sonner";
import { Ticket, Upload, QrCode, Lock, Loader2, Download, Megaphone, Eye, EyeOff, ShieldCheck, CheckCircle2 } from "lucide-react";
import { TicketShape } from "@/components/market/TicketShape";
import { composeTicketImage, downloadTicketPdf, ticketFilename, composeVerifiedQr } from "@/lib/ticket-composer";
import { cleanListingDescription } from "@/lib/clean-description";
import { getIsAdminUser } from "@/lib/admin-role";
import { handleEmailNotVerified } from "@/components/VerifyEmailDialog";


export const Route = createFileRoute("/tickets")({ component: TicketsPage });

function TicketsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"browse" | "upload" | "mine">("browse");

  const { data: profile } = useQuery({
    queryKey: ["me-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("is_star,is_verified").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => getIsAdminUser(user!.id),
  });

  const canUpload = !!isAdmin || (!!profile?.is_verified && !!profile?.is_star);

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Hero — matches Market Plug */}
        <div className="relative overflow-hidden bg-card border rounded-3xl p-6 shadow-card">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent" />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 text-[11px] font-semibold uppercase tracking-wider">
                <Ticket className="w-3.5 h-3.5" />
                Ticket Marketplace
              </div>
              <h1 className="mt-2 text-2xl md:text-3xl font-bold font-display leading-tight">
                Every campus event,{" "}
                <span className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
                  one tap away
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Buy verified tickets or sell yours — only Star + Authentication
                badge holders can list, so buyers always know what's real.
              </p>
            </div>
            <Button asChild size="sm" className="rounded-full shadow-glow bg-gradient-to-r from-fuchsia-500 to-rose-500 text-white hover:opacity-90">
              <Link to="/tools/qr"><QrCode className="w-4 h-4 mr-1" />Scan ticket</Link>
            </Button>
          </div>

          <div className="relative mt-5 inline-flex flex-wrap gap-1 p-1 rounded-full bg-muted/70 backdrop-blur border border-border/60">
            {[
              { k: "browse", label: "Browse" },
              { k: "upload", label: canUpload ? "Sell a ticket" : "Sell a ticket 🔒" },
              { k: "mine", label: "My purchases" },
            ].map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setTab(k as typeof tab)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                  tab === k
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "browse" && <BrowseTickets />}
        {tab === "upload" && (canUpload ? <UploadTicket userId={user?.id} /> : <LockedUpload />)}
        {tab === "mine" && <MyPurchases userId={user?.id} />}
      </div>
    </AppShell>
  );
}


function BrowseTickets() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["tickets-browse"],
    queryFn: async () => (await supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(60)).data ?? [],
  });

  const buyAndDownload = async (ticket: any) => {
    if (!user) { nav({ to: "/login" }); return; }
    // download runs in background — no popup
    setBuyingId(ticket.id);
    try {
      const { data: buyRes, error } = await supabase.rpc("buy_ticket", { _ticket_id: ticket.id });
      if (error) throw error;
      const buyerIndex = (buyRes as any)?.buyer_index as number | undefined;
      const qrToken = (buyRes as any)?.qr_token as string | undefined;

      const stampedTicket = await composeTicketImage({
        photoUrl: ticket.photo_url,
        qrToken: qrToken ?? "",
        title: ticket.title,
        holder: profile?.display_name || user.email || "Holder",
        buyerIndex,
      });

      await downloadTicketPdf(stampedTicket, ticketFilename(ticket.title, buyerIndex), null, {
        title: ticket.title,
        holder: profile?.display_name || user.email || "Holder",
        buyerIndex,
        qrToken: qrToken ?? "",
      });
      toast.success("Ticket PDF downloaded");
      qc.invalidateQueries({ queryKey: ["tickets-browse"] });
      qc.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      if (handleEmailNotVerified(err)) { setBuyingId(null); return; }
      toast.error(err.message ?? "PDF download failed");

    } finally {
      setBuyingId(null);
    }
  };

  if (isLoading) return <p className="text-center text-muted-foreground py-8">Loading…</p>;
  if (!data?.length) return <div className="text-center py-12 text-muted-foreground"><Ticket className="w-10 h-10 mx-auto mb-2 opacity-40" />No tickets for sale right now.</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {data.map((t) => (
        <div key={t.id} className="flex flex-col">
          <Link to="/tickets/$id" params={{ id: t.id }} className="block hover:-translate-y-0.5 transition-transform">
            <TicketShape className="flex bg-card border border-border/60 rounded-xl overflow-hidden h-40">
              <div className="w-[34%] shrink-0 relative overflow-hidden">
                {t.photo_url ? (
                  <img src={t.photo_url} alt={t.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500 to-rose-600" />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/70 via-pink-600/60 to-rose-700/80" />
                <div className="relative p-3 h-full flex flex-col justify-between text-white">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <Ticket className="w-3.5 h-3.5" /> Ticket
                  </div>
                  <div>
                    <div className="text-[10px] uppercase opacity-80">Price</div>
                    <div className="font-black text-lg leading-none drop-shadow">
                      {t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0 p-3 pl-5 flex flex-col">
                <h3 className="font-bold line-clamp-1 text-sm">{t.title}</h3>
                <p className="text-[11px] text-muted-foreground line-clamp-3 mt-0.5 flex-1">{cleanListingDescription(t.description)}</p>
                <div className="text-[10px] font-semibold text-primary mt-1">ADMIT ONE →</div>
              </div>
            </TicketShape>
          </Link>
          <Button type="button" onClick={() => buyAndDownload(t)} disabled={buyingId === t.id} className="mt-3 w-full">
            {buyingId === t.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Ticket className="w-4 h-4 mr-1" />}
            {buyingId === t.id ? "Downloading PDF…" : t.pay_mode === "credits" ? `Buy for ${t.price} cr` : `Buy for ₦${Number(t.price).toLocaleString()}`}
          </Button>
        </div>
      ))}
    </div>
  );
}

function LockedUpload() {
  return (
    <div className="bg-card border-2 border-dashed rounded-2xl p-8 text-center space-y-4">
      <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
      <h3 className="font-bold font-display text-lg">Selling tickets needs special badges</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Only users with the <strong>Star</strong> badge <em>and</em> the <strong>Authentication</strong> badge can list tickets.
        Apply below and admin will review your request.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button asChild>
          <Link to="/apply-badge" search={{ badge: "star" }}>Apply for Star badge</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/me">Get Authentication (verify student)</Link>
        </Button>
      </div>
    </div>
  );
}

function UploadTicket({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("0");
  const [payMode, setPayMode] = useState<"contact" | "credits">("contact");
  const [contact, setContact] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !file) { toast.error("Add a ticket photo first"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("tickets").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data: signed, error: sErr } = await supabase.storage.from("tickets").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const pub = { publicUrl: signed.signedUrl };
      const ins = await supabase.from("tickets").insert({
        uploader_id: userId, title, description: desc, photo_url: pub.publicUrl,
        price: Number(price) || 0, pay_mode: payMode, contact: contact || null,
      }).select("id").single();
      if (ins.error) throw ins.error;

      if (shareToFeed && ins.data?.id) {
        const share = encodePlugShare({
          kind: "ticket",
          id: ins.data.id,
          href: `/tickets/${ins.data.id}`,
          contact: contact || null,
          authorId: userId,
        });
        const body =
          (desc?.trim() || `Ticket for sale: ${title}`) +
          `\n\nPrice: ${payMode === "credits" ? `${Number(price) || 0} credits` : `₦${Number(price) || 0}`}` +
          share;
        await supabase.from("posts").insert({
          author_id: userId,
          post_type: "ticket",
          title,
          body,
          image_url: pub.publicUrl,
        } as any);
      }

      toast.success(shareToFeed ? "Ticket listed & shared to the feed" : "Ticket listed");
      qc.invalidateQueries({ queryKey: ["tickets-browse"] });
      nav({ to: "/tickets" });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="bg-card border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold font-display text-lg flex items-center gap-2"><Upload className="w-5 h-5 text-primary" />List a ticket</h2>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ticket title (e.g. EBSU Cultural Night)" required maxLength={120} />
      <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Event details, date, venue, seat info…" rows={3} maxLength={1000} />
      <div className="grid grid-cols-2 gap-3">
        <Input type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (e.g. 0.1)" required />
        <Select value={payMode} onValueChange={(v) => setPayMode(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contact">Contact seller (₦)</SelectItem>
            <SelectItem value="credits">In-app credits</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {payMode === "contact" && (
        <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Your WhatsApp / phone" maxLength={120} />
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Ticket photo</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" required />
      </div>
      <label className="flex items-start gap-3 p-3 rounded-2xl border bg-muted/40 cursor-pointer">
        <Switch checked={shareToFeed} onCheckedChange={setShareToFeed} className="mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <Megaphone className="w-4 h-4 text-primary" /> Do you want this to appear in the feed?
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cross-post to the main feed with quick buttons (Chat host, Contact) so more students see it.
          </p>
        </div>
      </label>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Uploading…" : shareToFeed ? "Publish ticket & share to feed" : "Publish ticket"}</Button>
    </form>
  );
}

function MyPurchases({ userId }: { userId?: string }) {
  const { data } = useQuery({
    queryKey: ["my-tickets", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("ticket_purchases").select("*, ticket:tickets(*)").eq("buyer_id", userId!).order("created_at", { ascending: false })).data ?? [],
  });
  if (!userId) return <p className="text-muted-foreground text-sm">Sign in to view your tickets.</p>;
  if (!data?.length) return <p className="text-muted-foreground text-sm text-center py-8">No purchases yet.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {data.map((p: any) => <PurchasedTicket key={p.id} p={p} />)}
    </div>
  );
}

function PurchasedTicket({ p }: { p: any }) {
  const { user, profile } = useAuth();
  const [qr, setQr] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const scanned = !!p.used_at;
  const buyerIndex = p.buyer_index as number | undefined;

  useEffect(() => {
    composeVerifiedQr(p.qr_token, 320).then(setQr);
  }, [p.qr_token]);

  const downloadPurchasedTicket = async () => {
    // download runs in background — no popup
    setDownloading(true);
    try {
      const stampedTicket = await composeTicketImage({
        photoUrl: p.ticket?.photo_url,
        qrToken: p.qr_token,
        title: p.ticket?.title ?? "Ticket",
        holder: profile?.display_name || user?.email || "Holder",
        buyerIndex,
      });
      await downloadTicketPdf(stampedTicket, ticketFilename(p.ticket?.title ?? "ticket", buyerIndex), null, {
        title: p.ticket?.title ?? "Ticket",
        holder: profile?.display_name || user?.email || "Holder",
        buyerIndex,
        qrToken: p.qr_token,
      });
      toast.success("Ticket PDF downloaded");
    } catch (err: any) {
      // no popup to close
      toast.error(err.message ?? "PDF download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-card border rounded-2xl p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{p.ticket?.title}</h3>
          <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {buyerIndex ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              Buyer #{buyerIndex}
            </span>
          ) : null}
          {scanned ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              <CheckCircle2 className="w-3 h-3" /> Scanned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[11px] font-bold">
              <ShieldCheck className="w-3 h-3" /> Unused
            </span>
          )}
        </div>
      </div>

      <div className="relative mt-3 mx-auto w-72 h-72 rounded-xl overflow-hidden bg-white flex items-center justify-center">
        {qr && (
          <img
            src={qr}
            alt="Ticket QR"
            className={`w-full h-full transition ${revealed && !scanned ? "" : "blur-2xl scale-110"}`}
          />
        )}
        {scanned && (
          <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/20 backdrop-blur-sm">
            <div className="text-center">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700 mt-1">Scanned & used</p>
              <p className="text-[10px] text-emerald-700/80">{new Date(p.used_at).toLocaleString()}</p>
            </div>
          </div>
        )}
        {!scanned && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 text-white text-[11px] font-semibold backdrop-blur"
            aria-label={revealed ? "Hide QR" : "Reveal QR"}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? "Hide" : "Reveal"}
          </button>
        )}
      </div>
      {!scanned && (
        <p className="text-[11px] text-center text-muted-foreground mt-1">
          QR stays blurred — only unblur when you're at the gate.
        </p>
      )}

      <Button type="button" onClick={downloadPurchasedTicket} disabled={downloading || !p.ticket?.photo_url} className="mt-3 w-full">
        {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
        {downloading ? "Downloading PDF…" : "Download ticket PDF"}
      </Button>
    </div>
  );
}
