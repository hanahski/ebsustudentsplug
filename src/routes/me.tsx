import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AvatarDisplay } from "@/components/AvatarDisplay";
import { RankBadge } from "@/components/RankBadge";
import { AVATAR_KEYS, AVATARS, avatarDataUri } from "@/lib/avatars";
import { encouragement, nextLevelLabel, rankProgress } from "@/lib/ranks";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LogOut, Coins, Camera, Ticket, Bookmark, ShieldCheck, Library, Shield, UserCog, Award, KeyRound, LayoutDashboard, Settings as SettingsIcon, Megaphone } from "lucide-react";
import { enhanceImageFile } from "@/lib/image-enhance";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AvatarLightbox } from "@/components/AvatarLightbox";
import { VerifyStudentDialog } from "@/components/VerifyStudentDialog";
import { SpecialBadges } from "@/components/SpecialBadges";
import { getIsAdminUser } from "@/lib/admin-role";

const ACADEMIC_LEVELS = ["100", "200", "300", "400", "500", "Postgraduate", "Alumni"];

export const Route = createFileRoute("/me")({ component: MePage });

function MePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/login" }); }, [user, loading]);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("boy-1");
  const [dept, setDept] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [showOnline, setShowOnline] = useState(true);
  const [code, setCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverVideoUploading, setCoverVideoUploading] = useState(false);
  const coverVideoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);


  useEffect(() => {
    if (profile) {
      setName(profile.display_name);
      setBio(profile.bio ?? "");
      setAvatar(profile.avatar_key);
      setDept(profile.department_id ?? "");
      setLevel((profile as any).academic_level ?? "");
      setShowOnline(profile.show_online);
    }
  }, [profile]);

  const { data: depts } = useQuery({
    queryKey: ["all-depts"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });

  const { data: refStats } = useQuery({
    queryKey: ["refs", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, count } = await supabase.from("referrals").select("*", { count: "exact" }).eq("inviter_id", profile!.id);
      return { count: count ?? 0, list: data ?? [] };
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-extra", profile?.id],
    enabled: !!profile,
      queryFn: async () => (await supabase.from("profiles").select("referral_code").eq("id", profile!.id).maybeSingle()).data,
  });

  const qc = useQueryClient();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", profile?.id],
    enabled: !!profile,
    queryFn: async () => getIsAdminUser(profile!.id),
  });

  const redeem = async () => {
    if (!code.trim()) return;
    const trimmed = code.trim();
    const { data: adminData } = await supabase.rpc("claim_admin_coupon" as any, { _coupon: trimmed });
    if (adminData && (adminData as any).ok) {
      toast.success("Admin access unlocked.");
      setCode("");
      refreshProfile();
      qc.invalidateQueries({ queryKey: ["is-admin"] });
      return;
    }
    const { error } = await supabase.rpc("redeem_referral", { _code: trimmed });
    if (error) toast.error(error.message.replace(/.*: /, ""));
    else { toast.success("+50 credits! Your inviter got +100."); setCode(""); refreshProfile(); }
  };


  const redeemCoupon = async () => {
    if (!couponCode.trim()) return;
    const { data, error } = await supabase.rpc("redeem_coupon" as any, { _code: couponCode.trim() });
    if (error) { toast.error(error.message.replace(/.*: /, "")); return; }
    const r = data as any;
    if (r?.ok) {
      toast.success(r.message ?? "Code redeemed!");
      setCouponCode("");
      refreshProfile();
      if (r.type === "admin") qc.invalidateQueries({ queryKey: ["is-admin"] });
    } else {
      toast.error(r?.message ?? "Invalid code");
    }
  };

  const uploadCover = async (file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Cover must be under 5MB"); return; }
    setCoverUploading(true);
    const t = toast.loading("Enhancing cover with AI…");
    try {
      const enhanced = await enhanceImageFile(file);
      toast.dismiss(t);
      if (enhanced !== file) toast.success("Cover enhanced");
      const ext = (enhanced.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("covers").upload(path, enhanced, { upsert: true, contentType: enhanced.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const { error: updErr } = await supabase.from("profiles").update({ cover_url: signed.signedUrl } as any).eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success("Cover updated");
      refreshProfile();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const uploadCoverVideo = async (file: File) => {
    if (!profile) return;
    if (!file.type.startsWith("video/")) { toast.error("Pick a video file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Cover video must be under 5MB"); return; }
    // Enforce ≤10s duration
    try {
      const durationOk = await new Promise<boolean>((resolve) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => {
          URL.revokeObjectURL(v.src);
          resolve(!Number.isFinite(v.duration) || v.duration <= 10.5);
        };
        v.onerror = () => resolve(true);
        v.src = URL.createObjectURL(file);
      });
      if (!durationOk) { toast.error("Cover video must be 10 seconds or shorter"); return; }
    } catch {}
    setCoverVideoUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${profile.id}/cover-video-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("covers")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ cover_video_url: signed.signedUrl } as any)
        .eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success("Cover video updated");
      refreshProfile();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setCoverVideoUploading(false);
    }
  };

  const removeCoverVideo = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from("profiles")
      .update({ cover_video_url: null } as any)
      .eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success("Cover video removed"); refreshProfile(); }
  };


  const uploadPhoto = async (file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5MB"); return; }
    setPhotoUploading(true);
    const t = toast.loading("Enhancing photo with AI…");
    try {
      const enhanced = await enhanceImageFile(file);
      toast.dismiss(t);
      if (enhanced !== file) toast.success("Photo enhanced");
      const ext = (enhanced.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("covers").upload(path, enhanced, { upsert: true, contentType: enhanced.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr) throw sErr;
      setAvatar(signed.signedUrl);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_key: signed.signedUrl } as any).eq("id", profile.id);
      if (updErr) throw updErr;
      toast.success("Photo updated");
      refreshProfile();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const copyCode = () => {
    if (!myProfile?.referral_code) return;
    navigator.clipboard.writeText(myProfile.referral_code);
    toast.success("Code copied!");
  };

  if (loading) return <AppShell><div className="max-w-3xl mx-auto py-10 text-center text-muted-foreground">Loading your profile…</div></AppShell>;
  if (!user) return <AppShell><div className="max-w-3xl mx-auto py-10 text-center text-muted-foreground">Redirecting to login…</div></AppShell>;
  if (!profile) return (
    <AppShell>
      <div className="max-w-3xl mx-auto py-10 text-center space-y-3">
        <p className="font-semibold">We couldn't load your profile</p>
        <p className="text-sm text-muted-foreground">This is usually a temporary connection issue.</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => refreshProfile()}>Retry</Button>
          <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/login" }); }}>Sign out</Button>
        </div>
      </div>
    </AppShell>
  );
  const prog = rankProgress(profile.approved_post_count);

  const save = async () => {
    const { error } = await supabase.from("profiles").update({
      display_name: name, bio, avatar_key: avatar, department_id: dept || null,
      show_online: showOnline, academic_level: level || null,
    } as any).eq("id", profile.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); refreshProfile(); }
  };

  const coverUrl = (profile as any).cover_url as string | null;
  const coverVideoUrl = (profile as any).cover_video_url as string | null;

  const hasPhoto = !!profile.avatar_key && profile.avatar_key.startsWith("http");
  const completionItems = [
    { label: "Add a bio", done: !!profile.bio },
    { label: "Pick your department", done: !!profile.department_id },
    { label: "Set your academic level", done: !!(profile as any).academic_level },
    { label: "Upload your photo", done: hasPhoto },
    { label: "Publish your first post", done: profile.approved_post_count > 0 },
  ];
  const completed = completionItems.filter((i) => i.done).length;
  const completionPct = Math.round((completed / completionItems.length) * 100);


  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Premium hero header */}
        <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-7 shadow-card">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-3xl" aria-hidden />
          <div className="absolute top-8 left-1/2 w-40 h-40 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
              <UserCog className="w-3.5 h-3.5" /> Your Profile
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black font-display leading-[1.05] bg-gradient-to-br from-foreground via-primary to-fuchsia-500 bg-clip-text text-transparent">
              This is your plug.
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              Customize your presence, unlock badges, and keep your campus card sharp.
            </p>
          </div>
        </section>

        <section className="bg-card border rounded-3xl shadow-card overflow-hidden">

          <div
            className="relative h-32 sm:h-44 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 bg-cover bg-center"
            style={!coverVideoUrl && coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
          >
            {coverVideoUrl && (
              <video
                src={coverVideoUrl}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
            <input ref={coverVideoInputRef} type="file" accept="video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCoverVideo(f); e.target.value = ""; }} />
            <div className="absolute bottom-2 right-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}
                className="inline-flex items-center gap-1 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-background">
                <Camera className="w-3.5 h-3.5" />{coverUploading ? "Uploading…" : coverUrl ? "Change image" : "Add image"}
              </button>
              <button type="button" onClick={() => coverVideoInputRef.current?.click()} disabled={coverVideoUploading}
                className="inline-flex items-center gap-1 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-background">
                🎬 {coverVideoUploading ? "Uploading…" : coverVideoUrl ? "Change video" : "Add video"}
              </button>
              {coverVideoUrl && (
                <button type="button" onClick={removeCoverVideo}
                  className="inline-flex items-center gap-1 bg-background/80 backdrop-blur px-3 py-1.5 rounded-full text-xs font-semibold border hover:bg-background text-destructive">
                  ✕ Remove video
                </button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">

            <div className="flex items-center gap-4 flex-wrap">
              <Link
                to="/me/avatar"
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Change avatar"
              >
                <AvatarDisplay avatarKey={profile.avatar_key} size={80} online={profile.show_online} photoUrl={(profile as any).picture_url} />
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold font-display break-words leading-tight inline-flex items-center gap-1.5">
                  {profile.display_name}
                  <SpecialBadges profile={profile} size={20} />
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {!isAdmin && <RankBadge tier={profile.rank_tier} step={profile.rank_step} />}
                  <span className="text-xs text-muted-foreground">{profile.approved_post_count} posts</span>
                  {(profile as any).academic_level && <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{(profile as any).academic_level} level</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <ThemeToggle />
                <Button asChild variant="outline" size="sm"><Link to="/saved"><Bookmark className="w-4 h-4 mr-1" />Saved</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/bookshelf"><Library className="w-4 h-4 mr-1" />Bookshelf</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/profile/$id" params={{ id: profile.id }}>View public profile</Link></Button>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold">Progress to {nextLevelLabel(prog.tier, prog.step)}</span>
                <span className="text-muted-foreground">{prog.postsInStep}/10 posts</span>
              </div>
              <div className="relative h-3 rank-track rounded-full overflow-hidden">
                <div className="h-full rank-fill rounded-full" style={{ width: `${prog.pct}%` }} />
                <span
                  className="absolute -top-1 h-5 w-5 -translate-x-1/2 rounded-full bg-background border-2 border-primary shadow-md flex items-center justify-center text-[10px] font-bold text-primary transition-all duration-700"
                  style={{ left: `${prog.pct}%` }}
                  aria-hidden
                >
                  {prog.pct}%
                </span>
              </div>

              <p className="text-xs text-primary mt-2 italic">{encouragement(profile.approved_post_count)}</p>
            </div>
          </div>
        </section>

        {completionPct < 100 && (
          <section className="bg-card border rounded-3xl shadow-card p-5 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold font-display text-lg flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" />Complete your profile</h2>
              <span className="text-sm font-bold text-primary">{completionPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
              <div className="h-full bg-hero transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-sm">
              {completionItems.map((it) => (
                <li key={it.label} className={`flex items-center gap-2 ${it.done ? "text-muted-foreground line-through" : ""}`}>
                  <span className={`w-4 h-4 rounded-full border-2 inline-flex items-center justify-center text-[10px] ${it.done ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"}`}>{it.done ? "✓" : ""}</span>
                  {it.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isAdmin && (
          <section className="bg-card border rounded-3xl shadow-card p-4 flex items-center justify-between gap-4 bg-gradient-to-br from-amber-500/10 to-yellow-500/5">
            <div>
              <h2 className="font-bold font-display flex items-center gap-2"><Coins className="w-5 h-5 text-amber-500" /> Admin — unlimited credits</h2>
              <Link to="/admin" className="text-xs text-primary inline-flex items-center gap-1 mt-1"><Shield className="w-3 h-3" /> Open Admin Panel</Link>
            </div>
            <div className="text-4xl font-bold text-amber-500 leading-none">∞</div>
          </section>
        )}

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ProfileTile to="/me/edit" label="Edit Profile" desc="Name, department, bio" icon={UserCog} gradient="from-sky-500 to-blue-600" />
          <ProfileTile to="/me/avatar" label="Avatar" desc="Pick or upload" icon={Camera} gradient="from-pink-500 to-rose-600" />
          <ProfileTile to="/apply-badge" label="Special Badge" desc="Apply for a badge" icon={Award} gradient="from-amber-500 to-orange-600" />
          <ProfileTile onClick={() => setVerifyOpen(true)} label="Get Verified" desc={profile.is_verified ? "You're verified ✓" : "Verify as a student"} icon={ShieldCheck} gradient="from-emerald-500 to-teal-600" />
          <ProfileTile to="/me/security" label="Password & Security" desc="Password, 2FA, alerts" icon={KeyRound} gradient="from-violet-500 to-fuchsia-600" />
          <ProfileTile to="/dashboard" label="Dashboard" desc="Credits, payouts" icon={LayoutDashboard} gradient="from-indigo-500 to-purple-600" />
          <ProfileTile to="/market/new" search={{ kind: "advert" }} label="Advert" desc="Advertise on the site" icon={Megaphone} gradient="from-amber-500 to-orange-600" />
          <ProfileTile to="/settings" label="Settings" desc="Preferences & privacy" icon={SettingsIcon} gradient="from-slate-500 to-slate-700" />

        </section>

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => { signOut(); nav({ to: "/" }); }}>
            <LogOut className="w-4 h-4 mr-1" />Sign out
          </Button>
        </div>
      </div>
      <AvatarLightbox avatarKey={profile.avatar_key} photoUrl={(profile as any).picture_url} open={photoOpen} onClose={() => setPhotoOpen(false)} />
      <VerifyStudentDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
    </AppShell>
  );
}

function ProfileTile({ to, search, onClick, label, desc, icon: Icon, gradient }: {
  to?: string; search?: Record<string, any>; onClick?: () => void; label: string; desc: string; icon: any; gradient: string;
}) {
  const inner = (
    <>
      <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} text-white flex items-center justify-center shadow-lg overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" aria-hidden />
        <Icon className="w-5 h-5 relative drop-shadow" />
      </div>
      <div className="mt-3">
        <div className="font-semibold text-sm leading-tight">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{desc}</div>
      </div>
    </>
  );
  const cls = "group relative overflow-hidden bg-card border rounded-2xl p-4 shadow-card text-left transition hover:-translate-y-1 hover:shadow-glow hover:border-primary/40";
  const decor = <div className={`pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-20 blur-2xl transition`} aria-hidden />;
  if (to) return <Link to={to as any} search={search as any} className={cls}>{decor}{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{decor}{inner}</button>;
}



