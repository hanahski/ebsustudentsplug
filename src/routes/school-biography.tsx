import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  Sparkles,
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Share2,
  Printer,
  Filter,
  X,
  Upload,
  Loader2,
  Mail,
  Phone,
  Globe,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  MessageCircle,
  ShieldCheck,
  Quote,
  Grid3x3,
  Rows3,
  ArrowUp,
  ArrowDown,
  Camera,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { safeUserUpload, friendlyUploadError } from "@/lib/safe-upload";
import { supabase } from "@/integrations/supabase/client";
import { confirm } from "@/components/ConfirmProvider";
import {
  listSchoolBios,
  saveSchoolBio,
  deleteSchoolBio,
  reorderSchoolBios,
  type TSchoolBio,
} from "@/lib/school-bio.functions";

export const Route = createFileRoute("/school-biography")({
  component: SchoolBiographyPage,
  head: () => ({
    meta: [
      { title: "School Biography — StudentsPlug" },
      {
        name: "description",
        content:
          "Meet the people leading EBSU — SUG president, DVCs, course reps, coordinators and student representatives.",
      },
      { property: "og:title", content: "School Biography — EBSU" },
      {
        property: "og:description",
        content:
          "The faces behind EBSU leadership: SUG, DVCs, coordinators, course reps.",
      },
    ],
  }),
});

type Cat = TSchoolBio["category"];

const CATEGORIES: { key: Cat; label: string; short: string; hue: number }[] = [
  { key: "leadership", label: "Leadership (VC / DVC / BC)", short: "Leadership", hue: 42 },
  { key: "sug", label: "SUG", short: "SUG", hue: 260 },
  { key: "faculty_rep", label: "Faculty Reps", short: "Faculty", hue: 200 },
  { key: "course_rep", label: "Course Reps", short: "Course Rep", hue: 145 },
  { key: "coordinator", label: "Coordinators", short: "Coordinator", hue: 15 },
  { key: "student_rep", label: "Student Reps", short: "Student Rep", hue: 320 },
  { key: "other", label: "Other", short: "Other", hue: 190 },
];

function catMeta(k: Cat) {
  return CATEGORIES.find((c) => c.key === k) ?? CATEGORIES[CATEGORIES.length - 1];
}

function hueFor(p: TSchoolBio) {
  return typeof p.hue === "number" ? p.hue : catMeta(p.category).hue;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* --------------------------- Avatar ring --------------------------- */

function CircleAvatar({
  profile,
  size = 96,
  className = "",
}: {
  profile: TSchoolBio;
  size?: number;
  className?: string;
}) {
  const h = hueFor(profile);
  const from = `hsl(${h} 85% 62%)`;
  const to = `hsl(${(h + 40) % 360} 85% 48%)`;
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* spinning conic ring */}
      <div
        className="absolute inset-0 rounded-full opacity-90 group-hover:animate-[spin_6s_linear_infinite]"
        style={{
          background: `conic-gradient(from 0deg, ${from}, ${to}, ${from})`,
          padding: 3,
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
        }}
        aria-hidden
      />
      {/* soft glow */}
      <div
        className="absolute -inset-2 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition"
        style={{ background: `radial-gradient(closest-side, ${to}, transparent 70%)` }}
        aria-hidden
      />
      <div
        className="absolute inset-[3px] rounded-full overflow-hidden bg-card flex items-center justify-center"
        style={{
          background:
            profile.avatar_url
              ? undefined
              : `linear-gradient(135deg, ${from}, ${to})`,
        }}
      >
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.name}
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <span
            className="text-white font-black"
            style={{ fontSize: size * 0.34, letterSpacing: -0.5 }}
          >
            {initialsOf(profile.name)}
          </span>
        )}
      </div>
      {/* category dot */}
      <div
        className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-card shadow"
        style={{ background: to }}
        title={catMeta(profile.category).short}
      />
    </div>
  );
}

/* --------------------------- Profile card --------------------------- */

function BioCard({
  profile,
  isAdmin,
  onEdit,
  onDelete,
  onMove,
  index,
  total,
  dense,
}: {
  profile: TSchoolBio;
  isAdmin: boolean;
  onEdit: (p: TSchoolBio) => void;
  onDelete: (p: TSchoolBio) => void;
  onMove: (p: TSchoolBio, dir: -1 | 1) => void;
  index: number;
  total: number;
  dense: boolean;
}) {
  const [open, setOpen] = useState(false);
  const h = hueFor(profile);

  const share = async () => {
    const url = `${window.location.origin}/school-biography#${profile.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.name, text: profile.role, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const cat = catMeta(profile.category);

  return (
    <article
      id={profile.id}
      className="group relative rounded-3xl border bg-card shadow-card overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-glow"
      style={{
        boxShadow: open
          ? `0 20px 60px -20px hsl(${h} 85% 55% / 0.35)`
          : undefined,
      }}
    >
      {/* top gradient stripe */}
      <div
        className="h-14 w-full"
        style={{
          background: `linear-gradient(120deg, hsl(${h} 85% 60% / 0.35), hsl(${(h + 40) % 360} 85% 55% / 0.15) 60%, transparent)`,
        }}
        aria-hidden
      />
      <div className={`px-5 -mt-10 pb-5 ${dense ? "" : ""}`}>
        <div className="flex items-start gap-4">
          <div className="group">
            <CircleAvatar profile={profile} size={dense ? 76 : 92} />
          </div>
          <div className="min-w-0 flex-1 pt-8">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-[17px] leading-tight truncate">
                {profile.name}
              </h3>
              {profile.is_current !== false && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  <ShieldCheck className="w-3 h-3" /> Current
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground truncate">
              {profile.role}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                style={{
                  background: `hsl(${h} 85% 55% / 0.14)`,
                  color: `hsl(${h} 85% 42%)`,
                }}
              >
                {cat.short}
              </span>
              {profile.department && (
                <span className="text-[10px] text-muted-foreground truncate">
                  · {profile.department}
                </span>
              )}
              {profile.session && (
                <span className="text-[10px] text-muted-foreground">
                  · {profile.session}
                </span>
              )}
            </div>
          </div>
        </div>

        {profile.short_bio && (
          <p className="mt-3 text-sm text-foreground/85 line-clamp-3">
            {profile.short_bio}
          </p>
        )}

        <div className="mt-3 flex items-center gap-1.5">
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold border bg-background hover:bg-muted transition"
          >
            {open ? "Show less" : "Read more"}
            {open ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={share}
            className="h-9 w-9 rounded-full border bg-background hover:bg-muted inline-flex items-center justify-center"
            title="Share profile"
            aria-label="Share profile"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(profile)}
                className="h-9 w-9 rounded-full border bg-background hover:bg-muted inline-flex items-center justify-center"
                title="Edit"
                aria-label="Edit profile"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(profile)}
                className="h-9 w-9 rounded-full border bg-background hover:bg-destructive hover:text-destructive-foreground inline-flex items-center justify-center"
                title="Delete"
                aria-label="Delete profile"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Expandable details */}
        <div
          className={`grid transition-all ${
            open ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            {profile.quote && (
              <blockquote
                className="relative rounded-2xl p-4 pl-10 text-sm italic"
                style={{
                  background: `hsl(${h} 85% 55% / 0.08)`,
                  border: `1px solid hsl(${h} 85% 55% / 0.25)`,
                }}
              >
                <Quote
                  className="absolute left-3 top-3 w-5 h-5"
                  style={{ color: `hsl(${h} 85% 45%)` }}
                />
                {profile.quote}
              </blockquote>
            )}

            {profile.long_bio && (
              <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {profile.long_bio}
              </div>
            )}

            {profile.achievements && profile.achievements.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Highlights
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.achievements.map((a, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-muted/40"
                    >
                      ✨ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.socials && (
              <div className="mt-4 flex flex-wrap gap-2">
                <SocialLink
                  icon={Mail}
                  href={profile.socials.email ? `mailto:${profile.socials.email}` : null}
                  label="Email"
                />
                <SocialLink
                  icon={Phone}
                  href={profile.socials.phone ? `tel:${profile.socials.phone}` : null}
                  label="Call"
                />
                <SocialLink
                  icon={MessageCircle}
                  href={
                    profile.socials.whatsapp
                      ? `https://wa.me/${profile.socials.whatsapp.replace(/[^0-9]/g, "")}`
                      : null
                  }
                  label="WhatsApp"
                />
                <SocialLink icon={Instagram} href={profile.socials.instagram} label="Instagram" />
                <SocialLink icon={Twitter} href={profile.socials.x} label="X" />
                <SocialLink icon={Facebook} href={profile.socials.facebook} label="Facebook" />
                <SocialLink icon={Linkedin} href={profile.socials.linkedin} label="LinkedIn" />
                <SocialLink icon={Globe} href={profile.socials.website} label="Website" />
              </div>
            )}

            {isAdmin && (
              <div className="mt-4 flex items-center gap-1.5">
                <button
                  onClick={() => onMove(profile, -1)}
                  disabled={index === 0}
                  className="text-[11px] flex items-center gap-1 px-2 h-7 rounded-full border hover:bg-muted disabled:opacity-40"
                >
                  <ArrowUp className="w-3 h-3" /> Up
                </button>
                <button
                  onClick={() => onMove(profile, 1)}
                  disabled={index === total - 1}
                  className="text-[11px] flex items-center gap-1 px-2 h-7 rounded-full border hover:bg-muted disabled:opacity-40"
                >
                  <ArrowDown className="w-3 h-3" /> Down
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SocialLink({
  icon: Icon,
  href,
  label,
}: {
  icon: any;
  href?: string | null;
  label: string;
}) {
  if (!href) return null;
  const url =
    href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")
      ? href
      : `https://${href.replace(/^@/, "")}`;
  return (
    <a
      href={url}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold h-7 px-3 rounded-full border bg-background hover:bg-primary hover:text-primary-foreground transition"
      title={label}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </a>
  );
}

/* --------------------------- Composer --------------------------- */

function emptyBio(): TSchoolBio {
  return {
    id: newId(),
    name: "",
    role: "",
    category: "sug",
    faculty: "",
    department: "",
    level: "",
    session: "",
    avatar_url: "",
    short_bio: "",
    long_bio: "",
    quote: "",
    achievements: [],
    hue: null,
    is_current: true,
    socials: {},
    order: 0,
  };
}

function BioComposer({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: TSchoolBio | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TSchoolBio>(initial ?? emptyBio());
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [achInput, setAchInput] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const save = useServerFn(saveSchoolBio);
  const mut = useMutation({
    mutationFn: async () => save({ data: form } as any),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  useEffect(() => {
    if (open) {
      setForm(initial ?? emptyBio());
      setStep(0);
      setAchInput("");
    }
  }, [open, initial]);

  const set = <K extends keyof TSchoolBio>(k: K, v: TSchoolBio[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setSocial = (k: string, v: string) =>
    setForm((f) => ({ ...f, socials: { ...(f.socials ?? {}), [k]: v || null } }));

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const { path } = await safeUserUpload({
        bucket: "post-images",
        file,
        filename: file.name || "bio.png",
        contentType: file.type,
      });
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      set("avatar_url", data.publicUrl);
      toast.success("Photo added");
    } catch (e: any) {
      toast.error(friendlyUploadError(e));
    } finally {
      setUploading(false);
    }
  };

  const addAch = () => {
    const t = achInput.trim();
    if (!t) return;
    set("achievements", [...(form.achievements ?? []), t].slice(0, 20));
    setAchInput("");
  };
  const removeAch = (i: number) =>
    set("achievements", (form.achievements ?? []).filter((_, k) => k !== i));

  const canNext = step === 0 ? form.name.trim() && form.role.trim() : true;
  const h = hueFor(form);

  const Steps = ["Identity", "Story", "Contact", "Polish"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Live preview strip */}
        <div
          className="h-24 relative"
          style={{
            background: `linear-gradient(120deg, hsl(${h} 85% 55%), hsl(${(h + 40) % 360} 85% 48%))`,
          }}
        >
          <div className="absolute -bottom-8 left-5">
            <div className="group">
              <CircleAvatar profile={form} size={72} />
            </div>
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1">
            {Steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-8 bg-white" : "w-3 bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
        <DialogHeader className="px-5 pt-10">
          <DialogTitle className="text-lg">
            {initial ? "Edit profile" : "New biography"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Step {step + 1} of {Steps.length} · {Steps[step]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {step === 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="group">
                  <CircleAvatar profile={form} size={80} />
                </div>
                <div className="flex-1">
                  <input
                    ref={fileRef}
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pickImage(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4 mr-1" />
                    )}
                    {form.avatar_url ? "Change photo" : "Upload photo"}
                  </Button>
                  {form.avatar_url && (
                    <button
                      type="button"
                      onClick={() => set("avatar_url", "")}
                      className="ml-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <Field label="Full name">
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Chinedu Okafor"
                />
              </Field>
              <Field label="Role / title">
                <Input
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="e.g. SUG President · 2025/2026"
                />
              </Field>
              <Field label="Category">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        set("category", c.key);
                        if (form.hue == null) set("hue", c.hue);
                      }}
                      className={`text-[11px] font-bold px-3 h-8 rounded-full border transition ${
                        form.category === c.key
                          ? "text-white border-transparent"
                          : "bg-background hover:bg-muted"
                      }`}
                      style={
                        form.category === c.key
                          ? {
                              background: `linear-gradient(135deg, hsl(${c.hue} 85% 55%), hsl(${(c.hue + 40) % 360} 85% 48%))`,
                            }
                          : undefined
                      }
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Faculty">
                  <Input
                    value={form.faculty ?? ""}
                    onChange={(e) => set("faculty", e.target.value)}
                    placeholder="Faculty of Science"
                  />
                </Field>
                <Field label="Department">
                  <Input
                    value={form.department ?? ""}
                    onChange={(e) => set("department", e.target.value)}
                    placeholder="Computer Science"
                  />
                </Field>
                <Field label="Level">
                  <Input
                    value={form.level ?? ""}
                    onChange={(e) => set("level", e.target.value)}
                    placeholder="400L"
                  />
                </Field>
                <Field label="Session">
                  <Input
                    value={form.session ?? ""}
                    onChange={(e) => set("session", e.target.value)}
                    placeholder="2024/2025"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Short line (shown on the card)">
                <Textarea
                  rows={2}
                  value={form.short_bio ?? ""}
                  onChange={(e) => set("short_bio", e.target.value.slice(0, 220))}
                  placeholder="A one-liner about them (max 220 characters)."
                />
                <div className="text-[10px] text-muted-foreground text-right">
                  {(form.short_bio ?? "").length}/220
                </div>
              </Field>
              <Field label="Full biography (read more)">
                <Textarea
                  rows={8}
                  value={form.long_bio ?? ""}
                  onChange={(e) => set("long_bio", e.target.value)}
                  placeholder="Their background, vision, milestones, what students should know…"
                />
              </Field>
              <Field label="Signature quote">
                <Input
                  value={form.quote ?? ""}
                  onChange={(e) => set("quote", e.target.value)}
                  placeholder="e.g. Service before self."
                />
              </Field>
              <Field label="Highlights / achievements">
                <div className="flex gap-2">
                  <Input
                    value={achInput}
                    onChange={(e) => setAchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAch();
                      }
                    }}
                    placeholder="Type and press Enter"
                  />
                  <Button type="button" variant="outline" onClick={addAch}>
                    Add
                  </Button>
                </div>
                {form.achievements && form.achievements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.achievements.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-muted/40"
                      >
                        {a}
                        <button
                          type="button"
                          onClick={() => removeAch(i)}
                          className="opacity-60 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email">
                  <Input
                    value={form.socials?.email ?? ""}
                    onChange={(e) => setSocial("email", e.target.value)}
                    placeholder="name@ebsu.edu.ng"
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.socials?.phone ?? ""}
                    onChange={(e) => setSocial("phone", e.target.value)}
                    placeholder="+234…"
                  />
                </Field>
                <Field label="WhatsApp">
                  <Input
                    value={form.socials?.whatsapp ?? ""}
                    onChange={(e) => setSocial("whatsapp", e.target.value)}
                    placeholder="+234…"
                  />
                </Field>
                <Field label="Website">
                  <Input
                    value={form.socials?.website ?? ""}
                    onChange={(e) => setSocial("website", e.target.value)}
                    placeholder="https://…"
                  />
                </Field>
                <Field label="Instagram">
                  <Input
                    value={form.socials?.instagram ?? ""}
                    onChange={(e) => setSocial("instagram", e.target.value)}
                    placeholder="@handle or url"
                  />
                </Field>
                <Field label="X (Twitter)">
                  <Input
                    value={form.socials?.x ?? ""}
                    onChange={(e) => setSocial("x", e.target.value)}
                    placeholder="@handle or url"
                  />
                </Field>
                <Field label="Facebook">
                  <Input
                    value={form.socials?.facebook ?? ""}
                    onChange={(e) => setSocial("facebook", e.target.value)}
                    placeholder="profile url"
                  />
                </Field>
                <Field label="LinkedIn">
                  <Input
                    value={form.socials?.linkedin ?? ""}
                    onChange={(e) => setSocial("linkedin", e.target.value)}
                    placeholder="profile url"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Accent colour">
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={form.hue ?? catMeta(form.category).hue}
                  onChange={(e) => set("hue", Number(e.target.value))}
                  className="w-full"
                  style={{
                    background:
                      "linear-gradient(to right, hsl(0 85% 55%), hsl(60 85% 55%), hsl(120 85% 45%), hsl(180 85% 45%), hsl(240 85% 55%), hsl(300 85% 55%), hsl(360 85% 55%))",
                    borderRadius: 999,
                    height: 8,
                    appearance: "none",
                  }}
                />
                <div className="text-[11px] text-muted-foreground">
                  Hue: {form.hue ?? catMeta(form.category).hue}° — auto-glow uses this.
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_current !== false}
                  onChange={(e) => set("is_current", e.target.checked)}
                />
                Currently serving (adds "Current" badge)
              </label>

              {/* live preview */}
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Preview
                </div>
                <BioCard
                  profile={form}
                  isAdmin={false}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onMove={() => {}}
                  index={0}
                  total={1}
                  dense={false}
                />
              </div>
            </>
          )}
        </div>

        <div className="border-t px-5 py-3 flex items-center justify-between bg-muted/30">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          {step < Steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              style={{
                background: `linear-gradient(135deg, hsl(${h} 85% 55%), hsl(${(h + 40) % 360} 85% 45%))`,
              }}
              className="text-white"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || !form.name.trim() || !form.role.trim()}
              className="text-white"
              style={{
                background: `linear-gradient(135deg, hsl(${h} 85% 55%), hsl(${(h + 40) % 360} 85% 45%))`,
              }}
            >
              {mut.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1" />
              )}
              Publish
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/* --------------------------- Page --------------------------- */

function SchoolBiographyPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const list = useServerFn(listSchoolBios);
  const del = useServerFn(deleteSchoolBio);
  const reorder = useServerFn(reorderSchoolBios);
  const { data = [], isLoading } = useQuery<TSchoolBio[]>({
    queryKey: ["school-bios"],
    queryFn: () => list({} as any) as any,
    staleTime: 60_000,
  });

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Cat>("all");
  const [dense, setDense] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState<TSchoolBio | null>(null);

  // Keyboard shortcut: "n" opens composer for admin
  useEffect(() => {
    if (!isAdmin) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      if (t?.isContentEditable) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setEditing(null);
        setComposerOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!query) return true;
      return [
        p.name,
        p.role,
        p.department,
        p.faculty,
        p.short_bio,
        p.long_bio,
        ...(p.achievements ?? []),
      ]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(query));
    });
  }, [data, q, cat]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: data.length };
    for (const c of CATEGORIES) map[c.key] = 0;
    for (const p of data) map[p.category] = (map[p.category] ?? 0) + 1;
    return map;
  }, [data]);

  const onDelete = async (p: TSchoolBio) => {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      description: "This profile will be removed from the school biography.",
      confirmText: "Delete",
      variant: "destructive",
      icon: "trash",
    });
    if (!ok) return;
    try {
      await del({ data: { id: p.id } } as any);
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["school-bios"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  const onMove = async (p: TSchoolBio, dir: -1 | 1) => {
    const idx = data.findIndex((x) => x.id === p.id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= data.length) return;
    const next = data.slice();
    const [item] = next.splice(idx, 1);
    next.splice(to, 0, item);
    // Optimistic
    qc.setQueryData(["school-bios"], next);
    try {
      await reorder({ data: { ids: next.map((x) => x.id) } } as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Reorder failed");
      qc.invalidateQueries({ queryKey: ["school-bios"] });
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-card">
          <div
            className="absolute -top-24 -right-16 w-80 h-80 rounded-full blur-3xl opacity-40"
            style={{ background: "conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #f59e0b)" }}
            aria-hidden
          />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="relative flex items-start gap-4 flex-wrap">
            <Link
              to="/faculties"
              className="w-10 h-10 rounded-2xl border bg-background/70 backdrop-blur inline-flex items-center justify-center hover:bg-muted"
              aria-label="Back to catalogue"
              title="Back to catalogue"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-white flex items-center justify-center shadow-glow">
              <Crown className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Catalogue · School Biography
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold font-display leading-tight">
                Faces of{" "}
                <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500 bg-clip-text text-transparent">
                  EBSU
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.length} representative{data.length === 1 ? "" : "s"} · SUG, DVCs, coordinators, course reps and more.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDense((v) => !v)}
                className="h-9 w-9 rounded-full border bg-background inline-flex items-center justify-center hover:bg-muted"
                title={dense ? "Comfortable view" : "Compact view"}
                aria-label="Toggle density"
              >
                {dense ? <Rows3 className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => window.print()}
                className="h-9 w-9 rounded-full border bg-background inline-flex items-center justify-center hover:bg-muted"
                title="Print / save PDF"
                aria-label="Print"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search + category chips */}
          <div className="relative mt-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a name, role, department…"
                className="pl-9 h-11 rounded-full bg-background/70 backdrop-blur"
              />
              {q && (
                <button
                  onClick={() => setQ("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
              <Chip active={cat === "all"} onClick={() => setCat("all")}>
                <Filter className="w-3 h-3 mr-1" /> All
                <span className="ml-1.5 opacity-70">{counts.all}</span>
              </Chip>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  active={cat === c.key}
                  hue={c.hue}
                  onClick={() => setCat(c.key)}
                >
                  {c.short}
                  <span className="ml-1.5 opacity-70">{counts[c.key] ?? 0}</span>
                </Chip>
              ))}
            </div>
          </div>
        </header>

        {/* Grid */}
        {isLoading ? (
          <SkeletonGrid />
        ) : filtered.length === 0 ? (
          <EmptyState isAdmin={isAdmin} onCreate={() => { setEditing(null); setComposerOpen(true); }} hasAny={data.length > 0} />
        ) : (
          <div className={`grid gap-4 ${dense ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            {filtered.map((p, i) => (
              <BioCard
                key={p.id}
                profile={p}
                isAdmin={isAdmin}
                onEdit={(pp) => {
                  setEditing(pp);
                  setComposerOpen(true);
                }}
                onDelete={onDelete}
                onMove={onMove}
                index={data.findIndex((x) => x.id === p.id)}
                total={data.length}
                dense={dense}
              />
            ))}
          </div>
        )}
      </div>

      {/* Admin FAB */}
      {isAdmin && (
        <button
          onClick={() => {
            setEditing(null);
            setComposerOpen(true);
          }}
          className="fixed bottom-24 right-5 md:bottom-8 md:right-8 z-40 group"
          aria-label="Compose profile"
          title="Compose profile (N)"
        >
          <span className="absolute inset-0 -z-10 rounded-full blur-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 opacity-70 group-hover:opacity-100 animate-pulse" />
          <span className="relative flex items-center justify-center w-16 h-16 rounded-full text-white shadow-xl bg-gradient-to-br from-amber-500 via-rose-500 to-fuchsia-600 border-4 border-background transition-transform group-active:scale-95 group-hover:rotate-12">
            <Plus className="w-7 h-7" />
          </span>
        </button>
      )}

      <BioComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        initial={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["school-bios"] })}
      />
    </AppShell>
  );
}

function Chip({
  active,
  hue,
  children,
  onClick,
}: {
  active: boolean;
  hue?: number;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center text-[11px] font-bold px-3 h-8 rounded-full border transition ${
        active
          ? "text-white border-transparent shadow"
          : "bg-background hover:bg-muted"
      }`}
      style={
        active
          ? {
              background: `linear-gradient(135deg, hsl(${hue ?? 220} 85% 55%), hsl(${((hue ?? 220) + 40) % 360} 85% 45%))`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-3xl border bg-card p-5">
          <div className="h-14 -mx-5 -mt-5 rounded-t-3xl bg-muted animate-pulse" />
          <div className="flex items-start gap-4 -mt-6">
            <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
            <div className="pt-8 flex-1 space-y-2">
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  isAdmin,
  onCreate,
  hasAny,
}: {
  isAdmin: boolean;
  onCreate: () => void;
  hasAny: boolean;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed p-10 text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 flex items-center justify-center text-white shadow-glow">
        <Crown className="w-7 h-7" />
      </div>
      <h3 className="mt-3 font-bold text-lg">
        {hasAny ? "No match" : "No biography yet"}
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        {hasAny
          ? "Try a different search or category."
          : "Admins can add the first representative below."}
      </p>
      {isAdmin && !hasAny && (
        <Button className="mt-4" onClick={onCreate}>
          <Plus className="w-4 h-4 mr-1" /> Add first profile
        </Button>
      )}
    </div>
  );
}
