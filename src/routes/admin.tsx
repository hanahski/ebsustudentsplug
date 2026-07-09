import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useAdminView } from "@/hooks/use-admin-view";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "sonner";
import {
  Shield, Trash2, ShoppingBag, FileText, Users, LayoutDashboard,
  Inbox, Image as ImageIcon, BadgeCheck, Star, Sparkles, Plug, Ban, CheckCircle2,
  BookOpen, ShieldCheck, Ticket, Wand2, Newspaper, Coins, ScanLine, Library, GraduationCap, Tag, KeyRound, Flag,
  Share2, Link as LinkIcon, Copy, Download, ArrowLeft, Users2,
} from "lucide-react";
import { ToolEditor } from "@/components/admin/ToolEditor";
import { ToolPricesPanel } from "@/components/admin/ToolPricesPanel";
import { TaskComposerPanel } from "@/components/admin/TaskComposerPanel";
import { AdminAiPanel } from "@/components/admin/AdminAiPanel";
import { AdminAiBankPanel } from "@/components/admin/AdminAiBankPanel";
import { ToolAiPanel } from "@/components/admin/ToolAiPanel";
import { EbsuNewsPanel } from "@/components/admin/EbsuNewsPanel";
import { AdminIntegrations } from "@/components/admin/AdminIntegrations";
import { resolveBannerUrls } from "@/lib/banner-url";
import { claimSeedAdminRole, getIsAdminUser } from "@/lib/admin-role";

export const Route = createFileRoute("/admin")({ component: AdminPanel });

type Tab = "dashboard" | "ai" | "aibank" | "toolai" | "ebsunews" | "users" | "applications" | "reports" | "verifications" | "posts" | "listings" | "tickets" | "scans" | "catalogue" | "marketcats" | "banners" | "tools" | "prices" | "tasks" | "integrations";


function AdminPanel() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");

  const { data: isAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      await claimSeedAdminRole();
      return getIsAdminUser(user.id);
    },
  });

  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  if (loading || roleLoading) return <AppShell><p>Loading…</p></AppShell>;
  if (!isAdmin) return <AppShell><div className="text-center py-16"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-2" /><p className="font-semibold">Admin access required</p></div></AppShell>;

  const tabs: { k: Tab; label: string; icon: any }[] = [
    { k: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { k: "ai", label: "Admin AI", icon: Sparkles },
    { k: "aibank", label: "AI Bank", icon: Plug },
    { k: "toolai", label: "Tool AI", icon: Wand2 },
    { k: "ebsunews", label: "EBSU News AI", icon: Newspaper },
    { k: "users", label: "Users", icon: Users },
    { k: "applications", label: "Applications", icon: Inbox },
    { k: "reports", label: "Reports", icon: Flag },
    { k: "verifications", label: "Verifications", icon: GraduationCap },
    
    { k: "posts", label: "Posts", icon: FileText },
    { k: "listings", label: "Listings", icon: ShoppingBag },
    { k: "tickets", label: "Tickets", icon: Ticket },
    { k: "scans", label: "Scan Log", icon: ScanLine },
    { k: "catalogue", label: "Catalogue", icon: Library },
    { k: "marketcats", label: "Market categories", icon: Tag },
    { k: "banners", label: "Banners", icon: ImageIcon },
    { k: "tools", label: "Tools", icon: Wand2 },
    { k: "prices", label: "Tool Prices", icon: Coins },
    { k: "tasks", label: "Task Composer", icon: Coins },
    { k: "integrations", label: "Integrations", icon: KeyRound },
  ];

  const activeLabel = tabs.find((t) => t.k === tab)?.label ?? "Dashboard";

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Hero header with animated mesh gradient */}
        <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 admin-gradient-mesh a-fade-in text-white shadow-card">
          <div className="absolute inset-0 admin-grid-bg opacity-20 pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full a-float admin-gradient-warn opacity-30 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full a-float admin-gradient-cool opacity-25 blur-2xl pointer-events-none" style={{ animationDelay: "1.5s" }} />
          <div className="relative flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="admin-icon-tile w-12 h-12 a-glow-pulse" style={{ background: "linear-gradient(135deg, oklch(0.78 0.14 78), oklch(0.72 0.19 40))" }}>
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display leading-tight a-fade-up">Admin Panel</h1>
                <p className="text-sm text-white/85 a-fade-up a-stagger-1">Full control of users, content, badges &amp; banners.</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap a-fade-up a-stagger-2">
                  <span className="admin-chip"><span className="admin-dot admin-dot-live" /> Live</span>
                  <span className="admin-chip">{activeLabel}</span>
                </div>
              </div>
            </div>
            <div className="a-fade-up a-stagger-3"><AdminViewSwitch /></div>
          </div>
        </div>

        {/* Scrolling tab rail */}
        <div className="admin-glass p-3 a-fade-up a-stagger-1">
          <div className="flex gap-2 flex-nowrap overflow-x-auto scrollbar-hide -mx-1 px-1">
            {tabs.map(({ k, label, icon: Icon }, i) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`admin-tab admin-tab-hover admin-focus-ring shrink-0 a-fade-up ${tab === k ? "admin-tab-active a-pop" : ""}`}
                style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="a-fade-up" key={tab}>
          {tab === "dashboard" && <AdminDashboard />}
          {tab === "ai" && <AdminAiPanel />}
          {tab === "aibank" && <AdminAiBankPanel />}
          {tab === "toolai" && <ToolAiPanel />}
          {tab === "ebsunews" && <EbsuNewsPanel />}
          {tab === "users" && <AdminUsers />}
          {tab === "applications" && <AdminApplications />}
          {tab === "reports" && <AdminReports />}
          {tab === "verifications" && <AdminVerifications />}
          {tab === "posts" && <AdminPosts />}
          {tab === "listings" && <AdminListings />}
          {tab === "tickets" && <AdminTickets />}
          {tab === "scans" && <AdminScanLog />}
          {tab === "catalogue" && <AdminCatalogue />}
          {tab === "marketcats" && <AdminMarketCategories />}
          {tab === "banners" && <AdminBanners />}
          {tab === "tools" && <ToolEditor />}
          {tab === "prices" && <ToolPricesPanel />}
          {tab === "tasks" && <TaskComposerPanel />}
          {tab === "integrations" && <AdminIntegrations />}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon: Icon, tint = "primary", i = 0 }: { label: string; value: any; icon: any; tint?: "primary" | "success" | "warn" | "danger" | "cool" | "plum"; i?: number }) {
  const tintCls: Record<string, string> = {
    primary: "admin-gradient-primary",
    success: "admin-gradient-success",
    warn: "admin-gradient-warn",
    danger: "admin-gradient-danger",
    cool: "admin-gradient-cool",
    plum: "admin-gradient-plum",
  };
  return (
    <div className="admin-stat admin-stat-hover admin-stat-shine admin-glow-hover a-tilt-in" style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
          <div className="text-2xl font-bold font-display mt-1 a-count-up">{value ?? "—"}</div>
        </div>
        <div className={`admin-icon-tile w-10 h-10 ${tintCls[tint]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => (await supabase.rpc("admin_dashboard_stats" as any)).data as any,
    refetchInterval: 30_000,
  });
  const ranks = (stats?.rank_distribution ?? {}) as Record<string, number>;
  const recentLogins = (stats?.recent_logins ?? []) as Array<any>;
  const recentSignups = (stats?.recent_signups ?? []) as Array<any>;
  const timeAgo = (iso: string) => {
    if (!iso) return "—";
    const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  const rankTints: Record<string, string> = {
    newbie: "admin-gradient-cool",
    normal: "admin-gradient-primary",
    active: "admin-gradient-success",
    legend: "admin-gradient-warn",
    pro: "admin-gradient-plum",
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Online now" value={stats?.online_count} icon={Users} tint="success" i={0} />
        <StatCard label="Signups today" value={stats?.signups_today} icon={Sparkles} tint="warn" i={1} />
        <StatCard label="Signups 7d" value={stats?.signups_7d} icon={Sparkles} tint="cool" i={2} />
        <StatCard label="Total users" value={stats?.total_users} icon={Users} tint="primary" i={3} />
        <StatCard label="Total posts" value={stats?.total_posts} icon={FileText} tint="plum" i={4} />
        <StatCard label="Total listings" value={stats?.total_listings} icon={ShoppingBag} tint="danger" i={5} />
        <StatCard label="Tickets sold" value={stats?.total_tickets_sold} icon={Ticket} tint="success" i={6} />
        <StatCard label="Pending badges" value={stats?.pending_applications} icon={Inbox} tint="warn" i={7} />
      </div>

      <div className="admin-glass p-4 a-fade-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="admin-section-title text-base">Rank distribution</h3>
          <span className="admin-chip admin-chip-primary">{Object.values(ranks).reduce((a: number, b: any) => a + Number(b || 0), 0)} total</span>
        </div>
        <div className="grid grid-cols-5 gap-2 text-center">
          {["newbie", "normal", "active", "legend", "pro"].map((t, idx) => (
            <div key={t} className={`relative overflow-hidden rounded-xl p-3 text-white ${rankTints[t]} a-scale-in`} style={{ animationDelay: `${idx * 60}ms` }}>
              <div className="text-[10px] uppercase tracking-wider opacity-90">{t}</div>
              <div className="text-lg font-bold font-display a-count-up">{ranks[t] ?? 0}</div>
              <div className="absolute inset-0 admin-grid-bg opacity-15 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="admin-glass admin-glow-hover p-4 a-slide-in">
          <h3 className="admin-section-title text-base mb-3 flex items-center gap-2">
            <span className="admin-icon-tile w-8 h-8 admin-gradient-cool"><Users className="w-4 h-4" /></span>
            Recently active
          </h3>
          <ul className="admin-timeline space-y-0.5">
            {recentLogins.length === 0 && <li className="admin-empty">No activity yet.</li>}
            {recentLogins.map((u, i) => (
              <li key={u.id} className="admin-timeline-item a-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-center justify-between gap-2">
                  <Link to="/profile/$id" params={{ id: u.id }} className="text-sm font-medium hover:text-primary truncate">{u.display_name}</Link>
                  <span className="admin-chip">{timeAgo(u.last_seen_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="admin-glass admin-glow-hover p-4 a-slide-in" style={{ animationDelay: "80ms" }}>
          <h3 className="admin-section-title text-base mb-3 flex items-center gap-2">
            <span className="admin-icon-tile w-8 h-8 admin-gradient-warn"><Sparkles className="w-4 h-4" /></span>
            New users
          </h3>
          <ul className="admin-timeline space-y-0.5">
            {recentSignups.length === 0 && <li className="admin-empty">No signups yet.</li>}
            {recentSignups.map((u, i) => (
              <li key={u.id} className="admin-timeline-item a-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link to="/profile/$id" params={{ id: u.id }} className="block text-sm font-medium hover:text-primary truncate">{u.display_name}</Link>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email ?? "—"}</p>
                  </div>
                  <span className="admin-chip">{timeAgo(u.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdminUsers() {
  const [q, setQ] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,display_name,email,credits,approved_post_count,rank_tier,rank_step,is_verified,is_star,is_legit,is_sure_plug,status").order("approved_post_count", { ascending: false }).limit(100);
      if (q) query = query.or(`display_name.ilike.%${q}%,email.ilike.%${q}%`);
      return (await query).data ?? [];
    },
  });
  const { data: adminIds } = useQuery({
    queryKey: ["admin-ids"],
    queryFn: async () => new Set(((await supabase.from("user_roles").select("user_id").eq("role", "admin")).data ?? []).map((r) => r.user_id)),
  });

  const setBadge = async (uid: string, badge: string, value: boolean) => {
    const { error } = await supabase.rpc("admin_set_badge" as any, { _user_id: uid, _badge: badge, _value: value });
    if (error) toast.error(error.message); else { toast.success(`${badge} ${value ? "granted" : "revoked"}`); refetch(); }
  };
  const setStatus = async (uid: string, status: "active" | "blocked" | "deactivated") => {
    const { error } = await supabase.rpc("admin_set_user_status" as any, { _user_id: uid, _status: status });
    if (error) toast.error(error.message); else { toast.success(`User ${status}`); refetch(); }
  };
  const setRank = async (uid: string, tier: string, step: number) => {
    const { error } = await supabase.rpc("admin_set_rank" as any, { _user_id: uid, _tier: tier, _step: step });
    if (error) toast.error(error.message); else { toast.success("Rank set"); refetch(); }
  };
  const toggleAdmin = async (uid: string, currentlyAdmin: boolean) => {
    const op = currentlyAdmin
      ? supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin")
      : supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    const { error } = await op;
    if (error) toast.error(error.message); else { toast.success(currentlyAdmin ? "Admin removed" : "Admin granted"); refetch(); }
  };

  return (
    <div className="space-y-3">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…" />
      <div className="space-y-2">
        {(data ?? []).map((u: any) => {
          const isUserAdmin = adminIds?.has(u.id) ?? false;
          return (
            <div key={u.id} className="bg-card border rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link to="/profile/$id" params={{ id: u.id }} className="font-medium hover:text-primary line-clamp-1">
                    {u.display_name}
                    {isUserAdmin && <span className="ml-1 text-xs text-primary">[admin]</span>}
                    {u.status !== "active" && <span className="ml-1 text-xs text-destructive">[{u.status}]</span>}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">{u.email} · {u.approved_post_count} posts · {u.credits} cr · {u.rank_tier} {u.rank_step}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: "verified", label: "Auth", icon: BadgeCheck, on: u.is_verified },
                  { k: "star", label: "Star", icon: Star, on: u.is_star },
                  { k: "legit", label: "Legit", icon: CheckCircle2, on: u.is_legit },
                  { k: "sure_plug", label: "Plug", icon: Plug, on: u.is_sure_plug },
                ].map(({ k, label, icon: Icon, on }) => (
                  <button key={k} onClick={() => setBadge(u.id, k, !on)}
                    className={`px-2 py-1 rounded-full text-xs inline-flex items-center gap-1 border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-transparent"}`}>
                    <Icon className="w-3 h-3" />{label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <select className="text-xs bg-muted rounded-full px-2 py-1" value={u.rank_tier}
                  onChange={(e) => setRank(u.id, e.target.value, u.rank_step)}>
                  {["newbie", "normal", "active", "legend", "pro"].map((t) => <option key={t}>{t}</option>)}
                </select>
                <select className="text-xs bg-muted rounded-full px-2 py-1" value={u.rank_step}
                  onChange={(e) => setRank(u.id, u.rank_tier, Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>Step {s}</option>)}
                </select>
                {u.status === "active" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "blocked")}><Ban className="w-3 h-3 mr-1" />Block</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "deactivated")}>Deactivate</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "active")}><CheckCircle2 className="w-3 h-3 mr-1" />Reactivate</Button>
                )}
                <Button size="sm" variant={isUserAdmin ? "destructive" : "outline"} onClick={() => toggleAdmin(u.id, isUserAdmin)}>
                  {isUserAdmin ? "Revoke admin" : "Make admin"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminApplications() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-apps"],
    queryFn: async () => (await supabase.from("badge_applications").select("*,profiles:user_id(display_name,email)").order("created_at", { ascending: false })).data ?? [],
  });
  const review = async (id: string, userId: string, badge: string, status: "approved" | "rejected") => {
    if (status === "approved") {
      const { error } = await supabase.rpc("admin_set_badge" as any, { _user_id: userId, _badge: badge, _value: true });
      if (error) return toast.error(error.message);
    }
    const { error } = await supabase.from("badge_applications").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Application ${status}`); refetch(); }
  };
  return (
    <div className="space-y-2">
      {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">No applications yet.</p>}
      {(data ?? []).map((a: any) => (
        <div key={a.id} className="bg-card border rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{a.profiles?.display_name ?? "—"} <span className="text-xs text-muted-foreground">· {a.badge}</span></p>
              <p className="text-xs text-muted-foreground">{a.profiles?.email}{a.reg_number && ` · Reg: ${a.reg_number}`}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "pending" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : a.status === "approved" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-destructive/20 text-destructive"}`}>{a.status}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{a.reason}</p>
          {a.status === "pending" && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => review(a.id, a.user_id, a.badge, "approved")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(a.id, a.user_id, a.badge, "rejected")}>Reject</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


function AdminReports() {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: async () => {
      let q = supabase
        .from("user_reports")
        .select("*,reporter:reporter_id(display_name,email),target_user:target_user_id(display_name,email),target_post:target_post_id(id,title),target_listing:target_listing_id(id,title)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const setStatus = async (id: string, status: "resolved" | "dismissed") => {
    const { error } = await supabase.from("user_reports").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(`Report ${status}`); refetch(); }
  };

  const deletePost = async (postId: string, reportId: string) => {
    if (!confirm("Delete the reported post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) return toast.error(error.message);
    await supabase.from("user_reports").update({ status: "resolved", reviewed_at: new Date().toISOString() }).eq("id", reportId);
    toast.success("Post deleted, report resolved");
    refetch();
  };
  const deleteListing = async (listingId: string, reportId: string) => {
    if (!confirm("Delete the reported listing?")) return;
    const { error } = await supabase.from("market_listings").delete().eq("id", listingId);
    if (error) return toast.error(error.message);
    await supabase.from("user_reports").update({ status: "resolved", reviewed_at: new Date().toISOString() }).eq("id", reportId);
    toast.success("Listing deleted, report resolved");
    refetch();
  };

  const rows = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={filter === "pending" ? "default" : "outline"} onClick={() => setFilter("pending")}>Pending</Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        <span className="text-xs text-muted-foreground ml-auto">{isFetching ? "Refreshing…" : `${rows.length} report${rows.length === 1 ? "" : "s"}`}</span>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">No reports.</p>}
      {rows.map((r: any) => {
        const target = r.target_post
          ? { label: `Post: ${r.target_post.title ?? r.target_post.id}`, to: "/post/$id" as const, id: r.target_post.id }
          : r.target_listing
          ? { label: `Listing: ${r.target_listing.title ?? r.target_listing.id}`, to: "/market/$id" as const, id: r.target_listing.id }
          : r.target_user
          ? { label: `User: ${r.target_user.display_name ?? r.target_user.email ?? r.target_user_id}`, to: "/profile/$id" as const, id: r.target_user_id }
          : null;
        return (
          <div key={r.id} className="bg-card border rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  <span className="text-muted-foreground">Category:</span> {r.category}
                </p>
                <p className="text-xs text-muted-foreground">
                  From {r.reporter?.display_name ?? r.reporter?.email ?? "—"} · {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "pending" ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : r.status === "resolved" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{r.status}</span>
            </div>
            {r.subject && <p className="text-sm font-medium">{r.subject}</p>}
            {r.reason && <p className="text-sm whitespace-pre-wrap">{r.reason}</p>}
            {target && (
              <Link to={target.to} params={{ id: target.id }} className="inline-block text-xs text-primary hover:underline">
                → {target.label}
              </Link>
            )}
            {r.status === "pending" && (
              <div className="flex gap-2 flex-wrap pt-1">
                <Button size="sm" onClick={() => setStatus(r.id, "resolved")}>Mark resolved</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "dismissed")}>Dismiss</Button>
                {r.target_post_id && (
                  <Button size="sm" variant="destructive" onClick={() => deletePost(r.target_post_id, r.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete post
                  </Button>
                )}
                {r.target_listing_id && (
                  <Button size="sm" variant="destructive" onClick={() => deleteListing(r.target_listing_id, r.id)}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete listing
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminPosts() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: async () => (await supabase.from("posts").select("id,title,post_type,created_at,author_id,is_official,profiles:author_id(display_name)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const del = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refetch(); }
  };
  const toggleOfficial = async (id: string, current: boolean) => {
    const { error } = await supabase.from("posts").update({ is_official: !current } as any).eq("id", id);
    if (error) toast.error(error.message); else { toast.success(!current ? "Marked official" : "Unmarked"); refetch(); }
  };
  const toNote = async (id: string) => {
    const { data, error } = await supabase.rpc("admin_post_to_note" as any, { _post_id: id });
    if (error) toast.error(error.message); else toast.success("Converted to study note · " + String(data).slice(0, 8));
  };
  return (
    <div className="bg-card border rounded-2xl divide-y">
      {(data ?? []).map((p: any) => (
        <div key={p.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <Link to="/post/$id" params={{ id: p.id }} className="font-medium hover:text-primary line-clamp-1">
              {p.is_official && <ShieldCheck className="inline w-3.5 h-3.5 mr-1 text-primary" />}
              {p.title}
            </Link>
            <p className="text-xs text-muted-foreground">{p.post_type} · {p.profiles?.display_name ?? "—"}</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => toggleOfficial(p.id, !!p.is_official)} title="Mark as official admin post">
              <ShieldCheck className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => toNote(p.id)} title="Convert to study note">
              <BookOpen className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}


function AdminListings() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => (await supabase.from("market_listings").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const del = async (id: string) => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("market_listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refetch(); }
  };
  return (
    <div className="bg-card border rounded-2xl divide-y">
      {(data ?? []).map((l) => (
        <div key={l.id} className="p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to="/market/$id" params={{ id: l.id }} className="font-medium hover:text-primary line-clamp-1">{l.title}</Link>
            <p className="text-xs text-muted-foreground">{l.category} · ₦{Number(l.price).toLocaleString()} {l.is_sold && "· SOLD"}</p>
          </div>
          <Button size="sm" variant="destructive" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      ))}
    </div>
  );
}

type LinkKind = "internal" | "external" | "profile" | "post" | "book" | "course" | "ticket" | "none";

const LINK_KIND_OPTIONS: { value: LinkKind; label: string; hint: string; placeholder: string; prefix?: string }[] = [
  { value: "none", label: "No link", hint: "Banner won't be clickable", placeholder: "" },
  { value: "internal", label: "Page on this site", hint: "Any path on Students Plug (e.g. /games or /tools)", placeholder: "/tools" },
  { value: "external", label: "External website", hint: "Full URL starting with https://", placeholder: "https://example.com" },
  { value: "profile", label: "User profile", hint: "Paste a user ID — links to their profile", placeholder: "uuid…", prefix: "/profile/" },
  { value: "post", label: "Post", hint: "Post ID — links to the post page", placeholder: "post-id", prefix: "/post/" },
  { value: "book", label: "Book / Novel / Comic", hint: "Library book ID", placeholder: "book-id", prefix: "/books/read/" },
  { value: "course", label: "Course", hint: "Course ID", placeholder: "course-id", prefix: "/course/" },
  { value: "ticket", label: "Event ticket", hint: "Ticket ID", placeholder: "ticket-id", prefix: "/tickets/" },
];

function buildLinkUrl(kind: LinkKind, value: string): string {
  const v = value.trim();
  if (!v || kind === "none") return "";
  if (kind === "internal") return v.startsWith("/") || /^https?:\/\//i.test(v) ? v : `/${v}`;
  if (kind === "external") return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  const opt = LINK_KIND_OPTIONS.find((o) => o.value === kind);
  return opt?.prefix ? `${opt.prefix}${v}` : v;
}

type BannerLayout = "image-bg" | "image-left" | "image-right" | "image-top" | "text-only" | "split";
type BannerVariant = "auto" | "light" | "dark";
const LAYOUT_OPTIONS: { v: BannerLayout; label: string }[] = [
  { v: "image-bg", label: "Image background" },
  { v: "image-top", label: "Image on top" },
  { v: "image-left", label: "Image left" },
  { v: "image-right", label: "Image right" },
  { v: "split", label: "Split diagonal" },
  { v: "text-only", label: "Text only" },
];

function BannerLivePreview({ title, subtitle, imageUrl, ctaLabel, layout, accent, variant, previewRatio }: {
  title: string; subtitle: string; imageUrl: string; ctaLabel: string;
  layout: BannerLayout; accent: string; variant: BannerVariant; previewRatio: number | null;
}) {
  const isLight = variant === "light" || (variant === "auto" && (layout === "image-bg" || layout === "split"));
  const textCls = isLight ? "text-white" : "text-slate-900";
  const subCls = isLight ? "text-white/85" : "text-slate-700";
  const bgCls = isLight ? "" : "bg-white";
  const shadow = isLight ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]" : "";

  const Cta = ctaLabel ? (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: accent, color: "#fff" }}
    >{ctaLabel}</span>
  ) : null;

  const Text = (
    <div className={`flex-1 min-w-0 space-y-1 ${textCls}`}>
      <div className={`font-bold text-base leading-tight line-clamp-2 ${shadow}`}>{title}</div>
      {subtitle && <div className={`text-xs line-clamp-2 ${subCls} ${shadow}`}>{subtitle}</div>}
      {Cta && <div className="pt-1">{Cta}</div>}
    </div>
  );

  const Img = imageUrl ? (
    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full flex items-center justify-center text-xs text-white/70" style={{ background: accent }}>Image</div>
  );

  let body: React.ReactNode = null;
  if (layout === "image-bg") {
    body = (
      <div className="absolute inset-0">
        {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: accent }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 p-3 flex flex-col justify-end">{Text}</div>
      </div>
    );
  } else if (layout === "image-top") {
    body = (
      <div className={`absolute inset-0 flex flex-col ${bgCls}`}>
        <div className="h-2/3 relative overflow-hidden">{Img}</div>
        <div className="p-3">{Text}</div>
      </div>
    );
  } else if (layout === "image-left") {
    body = (
      <div className={`absolute inset-0 flex ${bgCls}`}>
        <div className="w-1/2 relative overflow-hidden">{Img}</div>
        <div className="w-1/2 p-3 flex items-center">{Text}</div>
      </div>
    );
  } else if (layout === "image-right") {
    body = (
      <div className={`absolute inset-0 flex ${bgCls}`}>
        <div className="flex-1 p-3 flex items-center">{Text}</div>
        <div className="w-1/2 relative overflow-hidden">{Img}</div>
      </div>
    );
  } else if (layout === "split") {
    body = (
      <div className="absolute inset-0">
        <div className="absolute inset-0" style={{ background: `linear-gradient(115deg, ${accent} 0%, ${accent} 55%, transparent 55%)` }} />
        {imageUrl && <img src={imageUrl} alt="" className="absolute inset-y-0 right-0 w-1/2 h-full object-cover" />}
        <div className="absolute inset-0 p-3 flex items-center"><div className="w-3/5">{Text}</div></div>
      </div>
    );
  } else {
    body = (
      <div className="absolute inset-0 p-4 flex items-center" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}05)` }}>
        <div className={bgCls === "" ? "text-slate-900" : ""}>{Text}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border bg-muted">
      <div className="aspect-[16/7] w-full relative">{body}</div>
      <p className="text-[11px] text-muted-foreground p-2">
        Live preview · home carousel size{previewRatio ? ` · source ${previewRatio.toFixed(2)}:1` : ""}
      </p>
    </div>
  );
}


function AdminBanners() {
  const { data, refetch } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const rows = (await supabase.from("banner_slides").select("*").order("sort_order", { ascending: true })).data ?? [];
      return resolveBannerUrls(rows as any[]);
    },
  });

  // CTR analytics
  const { data: ctr } = useQuery({
    queryKey: ["admin-banner-ctr"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("banner_events").select("banner_id, kind");
      const map = new Map<string, { impressions: number; clicks: number }>();
      (data ?? []).forEach((e: any) => {
        const m = map.get(e.banner_id) ?? { impressions: 0, clicks: 0 };
        if (e.kind === "impression") m.impressions++;
        else if (e.kind === "click") m.clicks++;
        map.set(e.banner_id, m);
      });
      return map;
    },
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [linkKind, setLinkKind] = useState<LinkKind>("none");
  const [linkValue, setLinkValue] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [previewRatio, setPreviewRatio] = useState<number | null>(null);
  const [layout, setLayout] = useState<BannerLayout>("image-bg");
  const [accent, setAccent] = useState("#0ea5e9");
  const [variant, setVariant] = useState<BannerVariant>("auto");
  const [publishAt, setPublishAt] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [rotationSeconds, setRotationSeconds] = useState<number>(6);

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const up = await supabase.storage.from("banners").upload(path, file, { upsert: false, contentType: file.type });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("banners").createSignedUrl(path, 60 * 60 * 24 * 365);
      setImagePath(path);
      setImageUrl(signed?.signedUrl ?? "");
      const im = new Image();
      im.onload = () => setPreviewRatio(im.width / im.height);
      if (signed?.signedUrl) im.src = signed.signedUrl;
      toast.success("Image uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const finalLinkUrl = buildLinkUrl(linkKind, linkValue);
  const linkOpt = LINK_KIND_OPTIONS.find((o) => o.value === linkKind)!;

  const add = async () => {
    if (!title) return toast.error("Title required");
    if (layout !== "text-only" && !imageUrl) return toast.error("Image required for this layout");
    const stored = imagePath || imageUrl;
    const { error } = await supabase.from("banner_slides").insert({
      title,
      subtitle,
      image_url: stored || null,
      link_url: finalLinkUrl || null,
      cta_label: ctaLabel.trim() || null,
      layout,
      accent: accent || null,
      variant,
      publish_at: publishAt ? new Date(publishAt).toISOString() : null,
      expire_at: expireAt ? new Date(expireAt).toISOString() : null,
      rotation_seconds: Math.max(2, Math.min(30, Number(rotationSeconds) || 6)),
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Banner added");
      setTitle(""); setSubtitle(""); setImageUrl(""); setImagePath("");
      setLinkKind("none"); setLinkValue(""); setCtaLabel("");
      setPreviewRatio(null); setLayout("image-bg"); setVariant("auto");
      setPublishAt(""); setExpireAt(""); setRotationSeconds(6);
      refetch();
    }
  };
  const toggle = async (id: string, is_active: boolean) => {
    await supabase.from("banner_slides").update({ is_active: !is_active }).eq("id", id);
    refetch();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await supabase.from("banner_slides").delete().eq("id", id);
    refetch();
  };
  const reorder = async (fromIdx: number, toIdx: number) => {
    const list = [...((data ?? []) as any[])];
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= list.length || toIdx >= list.length) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    // Rewrite sort_order sequentially
    await Promise.all(
      list.map((row: any, i: number) =>
        supabase.from("banner_slides").update({ sort_order: i }).eq("id", row.id),
      ),
    );
    refetch();
  };
  const dragFrom = useRef<number | null>(null);


  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-2xl p-3 space-y-3">
        <h3 className="font-semibold">Add new banner</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Subtitle (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />

        <div>
          <label className="block text-sm font-medium mb-1">Layout</label>
          <select value={layout} onChange={(e) => setLayout(e.target.value as BannerLayout)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
            {LAYOUT_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Accent colour</label>
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full rounded-md border bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Text theme</label>
            <select value={variant} onChange={(e) => setVariant(e.target.value as BannerVariant)} className="w-full h-10 px-3 rounded-md border bg-background text-sm">
              <option value="auto">Auto</option>
              <option value="light">Light text</option>
              <option value="dark">Dark text</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium mb-1">Publish at (optional)</label>
            <input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expire at (optional)</label>
            <input type="datetime-local" value={expireAt} onChange={(e) => setExpireAt(e.target.value)} className="w-full h-10 px-3 rounded-md border bg-background text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Show for (seconds before swap)</label>
          <input
            type="number"
            min={2}
            max={30}
            value={rotationSeconds}
            onChange={(e) => setRotationSeconds(Number(e.target.value) || 6)}
            className="w-full h-10 px-3 rounded-md border bg-background text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Between 2 and 30 seconds. Default 6. The carousel waits for the image to load before it counts.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Banner image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
          <p className="text-[11px] text-muted-foreground mt-1">Any aspect ratio works — it auto-fits the carousel.</p>
        </div>
        <Input placeholder="…or paste image URL" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setImagePath(""); setPreviewRatio(null); }} />

        <BannerLivePreview
          title={title || "Your banner title"}
          subtitle={subtitle}
          imageUrl={imageUrl}
          ctaLabel={ctaLabel}
          layout={layout}
          accent={accent}
          variant={variant}
          previewRatio={previewRatio}
        />

        <div className="space-y-2 pt-2 border-t">
          <label className="block text-sm font-medium">Where should tapping this banner take people?</label>
          <select
            value={linkKind}
            onChange={(e) => { setLinkKind(e.target.value as LinkKind); setLinkValue(""); }}
            className="w-full h-10 px-3 rounded-md border bg-background text-sm"
          >
            {LINK_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">{linkOpt.hint}</p>
          {linkKind !== "none" && (
            <>
              <Input
                placeholder={linkOpt.placeholder}
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
              />
              {finalLinkUrl && (
                <p className="text-[11px] text-muted-foreground break-all">
                  Final URL: <span className="font-mono">{finalLinkUrl}</span>
                </p>
              )}
              <Input
                placeholder='Button label (e.g. "Read more", "Open")'
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
              />
            </>
          )}
        </div>

        <Button onClick={add} disabled={uploading || !title}>Add banner</Button>
      </div>

      <div className="space-y-2">
        {(data ?? []).map((b: any, idx: number) => {
          const stats = ctr?.get(b.id);
          const imp = stats?.impressions ?? 0;
          const clk = stats?.clicks ?? 0;
          const rate = imp > 0 ? ((clk / imp) * 100).toFixed(1) : "0.0";
          return (
            <div
              key={b.id}
              draggable
              onDragStart={() => { dragFrom.current = idx; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                dragFrom.current = null;
                if (from !== null && from !== idx) reorder(from, idx);
              }}
              className="bg-card border rounded-2xl p-3 flex items-center gap-3 cursor-move"
            >
              <div className="text-muted-foreground select-none" aria-hidden>⋮⋮</div>
              {b.image_url ? (
                <img src={b.image_url} alt={b.title} className="w-16 h-16 object-cover rounded-xl" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground">text</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{b.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{b.subtitle ?? ""}</p>
                <p className="text-[11px] text-muted-foreground">
                  {b.layout ?? "image-bg"} · {b.variant ?? "auto"}
                  {b.publish_at && ` · from ${new Date(b.publish_at).toLocaleDateString()}`}
                  {b.expire_at && ` · until ${new Date(b.expire_at).toLocaleDateString()}`}
                </p>
                <p className="text-[11px] text-primary">{imp} impressions · {clk} clicks · {rate}% CTR</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <label className="text-[11px] text-muted-foreground">Show for</label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    defaultValue={Number(b.rotation_seconds) || 6}
                    onBlur={async (e) => {
                      const v = Math.max(2, Math.min(30, Number(e.target.value) || 6));
                      if (v === (Number(b.rotation_seconds) || 6)) return;
                      const { error } = await supabase.from("banner_slides").update({ rotation_seconds: v } as any).eq("id", b.id);
                      if (error) toast.error(error.message); else { toast.success("Timing saved"); refetch(); }
                    }}
                    className="w-14 h-7 px-2 rounded border bg-background text-[11px]"
                  />
                  <span className="text-[11px] text-muted-foreground">seconds</span>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => toggle(b.id, b.is_active)}>{b.is_active ? "Hide" : "Show"}</Button>
              <Button size="sm" variant="destructive" onClick={() => del(b.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>

          );
        })}
      </div>
    </div>
  );
}


/**
 * Ticket Sales panel.
 *
 * Top level: one card per ticket/event with sold + used counts and revenue.
 * Realtime — new purchases/scans update instantly via postgres_changes.
 *
 * Drilling into a ticket shows a per-buyer roster:
 *   - buyer number, name, price paid, used/unused, purchase time
 *   - export the roster to a formatted PDF
 *   - create/copy/delete shareable public links to a live read-only view
 */
function AdminTickets() {
  const qc = useQueryClient();
  const [focusTicketId, setFocusTicketId] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["admin-ticket-sales-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ticket_sales_overview" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-ticket-sales-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_purchases" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-ticket-sales-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-ticket-roster"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_scans" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-ticket-sales-overview"] });
        qc.invalidateQueries({ queryKey: ["admin-ticket-roster"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-ticket-sales-overview"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (focusTicketId) {
    return <AdminTicketRoster ticketId={focusTicketId} onBack={() => setFocusTicketId(null)} />;
  }

  const rows = overview.data ?? [];
  const totalSold = rows.reduce((s: number, r: any) => s + Number(r.sold_count ?? 0), 0);
  const totalUsed = rows.reduce((s: number, r: any) => s + Number(r.used_count ?? 0), 0);
  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.revenue ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Tickets sold" value={totalSold} icon={Ticket} />
        <StatCard label="Checked in" value={totalUsed} icon={ScanLine} />
        <StatCard label="Revenue" value={`₦${Number(totalRevenue).toLocaleString()}`} icon={Sparkles} />
      </div>

      {overview.isLoading && <p className="text-sm text-muted-foreground">Loading sales…</p>}
      {!overview.isLoading && rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground bg-card border rounded-2xl">
          <Ticket className="w-10 h-10 mx-auto mb-2 opacity-40" />
          No tickets yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((t: any) => {
          const sold = Number(t.sold_count ?? 0);
          const used = Number(t.used_count ?? 0);
          const pct = sold > 0 ? Math.round((used / sold) * 100) : 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setFocusTicketId(t.id)}
              className="text-left group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-card/60 p-4 hover:border-primary/50 transition shadow-card"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl group-hover:bg-primary/20 transition" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold font-display text-lg leading-tight line-clamp-1">{t.title ?? "Untitled event"}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    By {t.uploader_name ?? "—"} · {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wide">
                  {t.pay_mode === "credits" ? "Credits" : "Cash"}
                </span>
              </div>
              <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-muted/40 p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Sold</div>
                  <div className="text-lg font-bold">{sold}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-2">
                  <div className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400">Used</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{used}</div>
                </div>
                <div className="rounded-xl bg-amber-500/10 p-2">
                  <div className="text-[10px] uppercase text-amber-600 dark:text-amber-400">Revenue</div>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-300 truncate">
                    {t.pay_mode === "credits" ? `${Number(t.revenue).toLocaleString()} cr` : `₦${Number(t.revenue).toLocaleString()}`}
                  </div>
                </div>
              </div>
              <div className="relative mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="relative text-[10px] text-muted-foreground mt-1">{pct}% checked in · tap to open</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Per-event roster with sharing + PDF export. Real-time via realtime channels
 * on ticket_purchases and ticket_scans (subscribed by parent).
 */
function AdminTicketRoster({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const roster = useQuery({
    queryKey: ["admin-ticket-roster", ticketId],
    queryFn: async () => {
      const [{ data: ticket }, { data: purchases }] = await Promise.all([
        supabase.from("tickets").select("id,title,pay_mode,price,photo_url,uploader_id,created_at").eq("id", ticketId).maybeSingle(),
        supabase.from("ticket_purchases")
          .select("id, buyer_id, buyer_index, price_paid, used_at, created_at, qr_token, buyer:profiles!ticket_purchases_buyer_id_fkey(display_name, avatar_key)")
          .eq("ticket_id", ticketId)
          .order("buyer_index", { ascending: true }),
      ]);
      return { ticket, purchases: (purchases ?? []) as any[] };
    },
  });

  const shares = useQuery({
    queryKey: ["admin-ticket-shares", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_share_links" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const ticket = roster.data?.ticket as any;
  const rows = roster.data?.purchases ?? [];
  const sold = rows.length;
  const used = rows.filter((r: any) => r.used_at).length;
  const revenue = rows.reduce((s: number, r: any) => s + Number(r.price_paid ?? 0), 0);

  const createShare = async () => {
    if (!user) return;
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("ticket_share_links" as any).insert({
      ticket_id: ticketId,
      token,
      created_by: user.id,
      label: `Live view for ${ticket?.title ?? "ticket"}`,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Share link created");
    qc.invalidateQueries({ queryKey: ["admin-ticket-shares", ticketId] });
  };

  const revokeShare = async (id: string) => {
    const { error } = await supabase.from("ticket_share_links" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Share link revoked");
    qc.invalidateQueries({ queryKey: ["admin-ticket-shares", ticketId] });
  };

  const copy = (token: string) => {
    const url = `${window.location.origin}/tickets/live/${token}`;
    navigator.clipboard?.writeText(url);
    toast.success("Copied share URL");
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Header band
    doc.setFillColor(109, 40, 217);
    doc.rect(0, 0, 595, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(ticket?.title ?? "Ticket sales", 32, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Sold: ${sold}   ·   Used: ${used}   ·   ${ticket?.pay_mode === "credits" ? `Revenue: ${revenue.toLocaleString()} cr` : `Revenue: NGN ${revenue.toLocaleString()}`}`,
      32,
      64,
    );
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()} · StudentsPlug Admin`, 32, 78);

    autoTable(doc, {
      startY: 110,
      head: [["#", "Buyer", "Paid", "Purchased", "Status"]],
      body: rows.map((r: any) => [
        `#${r.buyer_index ?? "-"}`,
        r.buyer?.display_name ?? r.buyer_id?.slice(0, 8) ?? "—",
        ticket?.pay_mode === "credits" ? `${r.price_paid} cr` : `NGN ${Number(r.price_paid ?? 0).toLocaleString()}`,
        new Date(r.created_at).toLocaleString(),
        r.used_at ? `Used ${new Date(r.used_at).toLocaleString()}` : "Not used",
      ]),
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 244, 253] },
      styles: { fontSize: 9, cellPadding: 6 },
      columnStyles: { 0: { cellWidth: 40 }, 4: { cellWidth: 130 } },
      margin: { left: 24, right: 24 },
    });

    const slug = (ticket?.title || "ticket-sales").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    doc.save(`${slug}-sales.pdf`);
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
        <ArrowLeft className="w-3 h-3" /> Back to all tickets
      </button>

      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/20 via-card to-card p-4 shadow-card">
        <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative flex items-start gap-3">
          {ticket?.photo_url && (
            <img src={ticket.photo_url} alt="" className="w-16 h-16 rounded-xl object-cover border shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold font-display line-clamp-1">{ticket?.title ?? "Ticket"}</h2>
            <p className="text-xs text-muted-foreground">
              {ticket?.pay_mode === "credits" ? `${Number(ticket?.price).toLocaleString()} cr` : `₦${Number(ticket?.price).toLocaleString()}`} · Since {ticket?.created_at ? new Date(ticket.created_at).toLocaleDateString() : "—"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="admin-chip">Sold: {sold}</span>
              <span className="admin-chip">Used: {used}</span>
              <span className="admin-chip">Revenue: {ticket?.pay_mode === "credits" ? `${revenue.toLocaleString()} cr` : `₦${revenue.toLocaleString()}`}</span>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={exportPdf} disabled={!rows.length}>
            <Download className="w-3.5 h-3.5 mr-1" /> Export PDF
          </Button>
          <Button size="sm" variant="outline" onClick={createShare}>
            <Share2 className="w-3.5 h-3.5 mr-1" /> Create share link
          </Button>
        </div>
      </div>

      {(shares.data?.length ?? 0) > 0 && (
        <div className="rounded-2xl border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live share links</p>
          {(shares.data ?? []).map((s: any) => {
            const url = `${window.location.origin}/tickets/live/${s.token}`;
            return (
              <div key={s.id} className="flex items-center gap-2 bg-muted/30 rounded-xl p-2">
                <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono truncate">{url}</p>
                  <p className="text-[10px] text-muted-foreground">Created {new Date(s.created_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(s.token)}><Copy className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revokeShare(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30 text-xs font-semibold text-muted-foreground flex items-center gap-2">
          <Users2 className="w-3.5 h-3.5" /> Roster ({sold} buyer{sold === 1 ? "" : "s"})
        </div>
        {roster.isLoading ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Loading roster…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">No buyers yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r: any) => (
              <li key={r.id} className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center text-xs font-bold shrink-0">
                  #{r.buyer_index ?? "-"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1">{r.buyer?.display_name ?? r.buyer_id?.slice(0, 8) ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">
                    {new Date(r.created_at).toLocaleString()} · {ticket?.pay_mode === "credits" ? `${r.price_paid} cr` : `₦${Number(r.price_paid ?? 0).toLocaleString()}`}
                  </p>
                </div>
                {r.used_at ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    Used {new Date(r.used_at).toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    Not used
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminScanLog() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-scans"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data: scans } = await supabase
        .from("ticket_scans" as any)
        .select("id, ticket_id, scanner_id, scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(200);
      const rows = (scans ?? []) as any[];
      if (!rows.length) return [];
      const ticketIds = [...new Set(rows.map((r) => r.ticket_id))];
      const userIds = [...new Set(rows.map((r) => r.scanner_id))];
      const [{ data: tickets }, { data: users }] = await Promise.all([
        supabase.from("tickets").select("id,title").in("id", ticketIds),
        supabase.from("profiles").select("id,display_name").in("id", userIds),
      ]);
      const tMap = new Map((tickets ?? []).map((t: any) => [t.id, t]));
      const uMap = new Map((users ?? []).map((u: any) => [u.id, u]));
      return rows.map((r) => ({ ...r, ticket: tMap.get(r.ticket_id), scanner: uMap.get(r.scanner_id) }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-ticket-scans")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_scans" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-scans"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Scans logged" value={data?.length ?? 0} icon={ScanLine} />
        <StatCard label="Unique tickets" value={new Set((data ?? []).map((r: any) => r.ticket_id)).size} icon={Ticket} />
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading scans…</p>}
      {!isLoading && !data?.length && (
        <div className="text-center py-12 text-muted-foreground bg-card border rounded-2xl">
          <ScanLine className="w-10 h-10 mx-auto mb-2 opacity-40" />
          No tickets have been scanned yet.
        </div>
      )}
      <div className="bg-card border rounded-2xl divide-y">
        {(data ?? []).map((r: any) => (
          <div key={r.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium line-clamp-1">{r.ticket?.title ?? "(deleted ticket)"}</p>
              <p className="text-xs text-muted-foreground">
                Scanned by {r.scanner?.display_name ?? r.scanner_id.slice(0, 8)} · {new Date(r.scanned_at).toLocaleString()}
              </p>
            </div>
            <span className="text-[10px] text-success inline-flex items-center gap-0.5 shrink-0"><CheckCircle2 className="w-3 h-3" />Verified</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminCatalogue() {
  const qc = useQueryClient();
  const [newFaculty, setNewFaculty] = useState({ name: "", icon: "📚" });
  const [newDept, setNewDept] = useState<{ name: string; faculty_id: string }>({ name: "", faculty_id: "" });
  const [newCourse, setNewCourse] = useState<{ code: string; title: string; department_id: string }>({ code: "", title: "", department_id: "" });

  const { data: faculties } = useQuery({
    queryKey: ["admin-faculties"],
    queryFn: async () => (await supabase.from("faculties").select("id,name,icon").order("name")).data ?? [],
  });
  const { data: departments } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: async () => (await supabase.from("departments").select("id,name,faculty_id").order("name")).data ?? [],
  });
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("id,code,title,department_id").order("code").limit(500)).data ?? [],
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-faculties"] });
    qc.invalidateQueries({ queryKey: ["admin-departments"] });
    qc.invalidateQueries({ queryKey: ["admin-courses"] });
  };

  const addFaculty = async () => {
    if (!newFaculty.name.trim()) return;
    const { error } = await supabase.from("faculties").insert(newFaculty as any);
    if (error) toast.error(error.message); else { toast.success("Faculty added"); setNewFaculty({ name: "", icon: "📚" }); refresh(); }
  };
  const addDept = async () => {
    if (!newDept.name.trim() || !newDept.faculty_id) return;
    const { error } = await supabase.from("departments").insert(newDept as any);
    if (error) toast.error(error.message); else { toast.success("Department added"); setNewDept({ name: "", faculty_id: "" }); refresh(); }
  };
  const addCourse = async () => {
    if (!newCourse.code.trim() || !newCourse.title.trim() || !newCourse.department_id) return;
    const { error } = await supabase.from("courses").insert({ ...newCourse, code: newCourse.code.toUpperCase() } as any);
    if (error) toast.error(error.message); else { toast.success("Course added"); setNewCourse({ code: "", title: "", department_id: "" }); refresh(); }
  };
  const delRow = async (table: "faculties" | "departments" | "courses", id: string) => {
    if (!confirm("Delete? This cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  return (
    <div className="space-y-5">
      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <h3 className="font-bold inline-flex items-center gap-2"><Library className="w-4 h-4" /> Faculties</h3>
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Name" value={newFaculty.name} onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })} className="flex-1 min-w-[160px]" />
          <Input placeholder="Icon (emoji)" value={newFaculty.icon} onChange={(e) => setNewFaculty({ ...newFaculty, icon: e.target.value })} className="max-w-[110px]" />
          <Button onClick={addFaculty}>Add</Button>
        </div>
        <ul className="divide-y border rounded-xl">
          {(faculties ?? []).map((f: any) => (
            <li key={f.id} className="p-2 flex items-center justify-between text-sm">
              <span>{f.icon} {f.name}</span>
              <Button size="sm" variant="destructive" onClick={() => delRow("faculties", f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <h3 className="font-bold inline-flex items-center gap-2"><BookOpen className="w-4 h-4" /> Departments</h3>
        <div className="flex gap-2 flex-wrap">
          <select value={newDept.faculty_id} onChange={(e) => setNewDept({ ...newDept, faculty_id: e.target.value })} className="bg-background border rounded-xl px-3 py-2 text-sm">
            <option value="">Faculty…</option>
            {(faculties ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <Input placeholder="Department name" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} className="flex-1 min-w-[180px]" />
          <Button onClick={addDept}>Add</Button>
        </div>
        <ul className="divide-y border rounded-xl max-h-72 overflow-auto">
          {(departments ?? []).map((d: any) => {
            const f = (faculties ?? []).find((x: any) => x.id === d.faculty_id);
            return (
              <li key={d.id} className="p-2 flex items-center justify-between text-sm">
                <span><span className="text-muted-foreground">{f?.name ?? "—"} ›</span> {d.name}</span>
                <Button size="sm" variant="destructive" onClick={() => delRow("departments", d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <h3 className="font-bold inline-flex items-center gap-2"><FileText className="w-4 h-4" /> Courses</h3>
        <div className="flex gap-2 flex-wrap">
          <select value={newCourse.department_id} onChange={(e) => setNewCourse({ ...newCourse, department_id: e.target.value })} className="bg-background border rounded-xl px-3 py-2 text-sm">
            <option value="">Department…</option>
            {(departments ?? []).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Input placeholder="Code (e.g. CSC 401)" value={newCourse.code} onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })} className="max-w-[160px]" />
          <Input placeholder="Title" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} className="flex-1 min-w-[180px]" />
          <Button onClick={addCourse}>Add</Button>
        </div>
        <ul className="divide-y border rounded-xl max-h-96 overflow-auto">
          {(courses ?? []).map((c: any) => (
            <li key={c.id} className="p-2 flex items-center justify-between text-sm">
              <span><strong className="text-primary">{c.code}</strong> · {c.title}</span>
              <Button size="sm" variant="destructive" onClick={() => delRow("courses", c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AdminVerifications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "verified" | "failed">("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-verifications", filter],
    queryFn: async () => {
      let query = supabase
        .from("student_verifications" as any)
        .select("id,user_id,jamb_reg_number,verified,response,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter === "verified") query = query.eq("verified", true);
      if (filter === "failed") query = query.eq("verified", false);
      const { data: rows } = await query;
      const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,email,avatar_key,is_verified")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (rows ?? []).map((r: any) => ({ ...r, profile: byId.get(r.user_id) }));
    },
  });

  const revoke = async (user_id: string) => {
    if (!confirm("Revoke this user's verified badge?")) return;
    const { error } = await supabase.rpc("admin_set_badge", {
      _user_id: user_id, _badge: "verified", _value: false,
    } as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Badge revoked");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    }
  };

  const exportCsv = () => {
    const rows = (data ?? []) as any[];
    const header = "created_at,jamb_reg_number,session,verified,user_id,display_name,email\n";
    const body = rows.map((r) => [
      r.created_at, r.jamb_reg_number, r.response?.session ?? "",
      r.verified ? "yes" : "no", r.user_id,
      (r.profile?.display_name ?? "").replaceAll(",", " "),
      r.profile?.email ?? "",
    ].join(",")).join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jamb-verifications-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filtered = (data ?? []).filter((r: any) => {
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (r.jamb_reg_number ?? "").toLowerCase().includes(needle)
      || (r.profile?.display_name ?? "").toLowerCase().includes(needle)
      || (r.profile?.email ?? "").toLowerCase().includes(needle);
  });

  const verifiedCount = (data ?? []).filter((r: any) => r.verified).length;
  const failedCount = (data ?? []).filter((r: any) => !r.verified).length;

  if (isLoading) return <p className="text-sm text-muted-foreground p-6 text-center">Loading verifications…</p>;

  return (
    <div className="space-y-3">
      <div className="bg-card border rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground mr-1">
          <span className="font-semibold text-foreground">{verifiedCount}</span> verified ·{" "}
          <span className="font-semibold text-foreground">{failedCount}</span> failed
        </div>
        {(["all", "verified", "failed"] as const).map((k) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize transition ${filter === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            {k}
          </button>
        ))}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search JAMB, name, email…" className="h-8 flex-1 min-w-[180px]" />
        <Button size="sm" variant="outline" onClick={exportCsv}>Export CSV</Button>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground p-6 text-center">No records.</p>
      )}
      {filtered.map((r: any) => (
        <div key={r.id} className="bg-card border rounded-2xl p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <GraduationCap className="w-4 h-4 text-primary" />
              <Link
                to="/profile/$id"
                params={{ id: r.user_id }}
                className="font-semibold hover:text-primary line-clamp-1"
              >
                {r.profile?.display_name ?? r.user_id.slice(0, 8)}
              </Link>
              {r.verified ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Verified</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300">Failed</span>
              )}
              {r.verified && !r.profile?.is_verified && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Badge revoked</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              <span className="font-mono">{r.jamb_reg_number}</span>
              {r.response?.session ? <> · {r.response.session}</> : null}
              {r.profile?.email ? <> · {r.profile.email}</> : null}
            </p>
            <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
          </div>
          {r.verified && r.profile?.is_verified && (
            <Button size="sm" variant="destructive" onClick={() => revoke(r.user_id)}>
              <Ban className="w-3.5 h-3.5 mr-1" /> Revoke
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminMarketCategories() {
  const qc = useQueryClient();
  const KINDS: { k: "products" | "tickets" | "books" | "advert"; label: string }[] = [
    { k: "products", label: "Products" },
    { k: "tickets", label: "Tickets" },
    { k: "books", label: "Books" },
    { k: "advert", label: "Adverts" },
  ];
  const [kind, setKind] = useState<"products" | "tickets" | "books" | "advert">("products");
  const [slug, setSlug] = useState("");
  const [label, setLabel] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-market-categories", kind],
    queryFn: async () =>
      (await supabase
        .from("marketplace_categories" as any)
        .select("*")
        .eq("kind", kind)
        .order("sort_order")
        .order("label")).data ?? [],
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-market-categories", kind] });

  const add = async () => {
    const s = slug.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    const l = label.trim();
    if (!s || !l) return toast.error("Slug and label required");
    const { error } = await supabase
      .from("marketplace_categories" as any)
      .insert({ kind, slug: s, label: l, sort_order: 100 });
    if (error) toast.error(error.message);
    else { toast.success("Category added"); setSlug(""); setLabel(""); refresh(); }
  };
  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase
      .from("marketplace_categories" as any)
      .update({ is_active: !is_active }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("marketplace_categories" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); refresh(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {KINDS.map((x) => (
          <button key={x.k} onClick={() => setKind(x.k)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${kind === x.k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="slug (e.g. hostel)" value={slug} onChange={(e) => setSlug(e.target.value)} className="max-w-[180px]" />
          <Input placeholder="Label shown to users" value={label} onChange={(e) => setLabel(e.target.value)} className="flex-1 min-w-[180px]" />
          <Button onClick={add}>Add category</Button>
        </div>
        <ul className="divide-y border rounded-xl">
          {(data ?? []).length === 0 && <li className="p-3 text-sm text-muted-foreground text-center">No categories yet.</li>}
          {(data ?? []).map((c: any) => (
            <li key={c.id} className="p-2 flex items-center justify-between text-sm gap-2">
              <span className={c.is_active ? "" : "opacity-50 line-through"}>
                <strong>{c.label}</strong> <span className="text-muted-foreground font-mono text-[11px]">{c.slug}</span>
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => toggle(c.id, c.is_active)}>
                  {c.is_active ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => del(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AdminViewSwitch() {
  const { asUser, setAsUser } = useAdminView();
  const nav = useNavigate();
  return (
    <label className="flex items-center gap-3 bg-muted/60 border rounded-2xl px-3 py-2 cursor-pointer select-none">
      <div className="text-right">
        <div className="text-xs font-bold leading-tight">{asUser ? "Viewing as user" : "Admin mode"}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">Toggle to switch role view</div>
      </div>
      <Switch
        checked={asUser}
        onCheckedChange={(v) => {
          setAsUser(v);
          if (v) nav({ to: "/" });
        }}
        aria-label="View as normal user"
      />
    </label>
  );
}
