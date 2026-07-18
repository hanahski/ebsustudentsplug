// EBSU News Composer — friendly 3-step guided flow.
// Visible only to admins and legit-badge users. Publishes to news_articles (news/announcement)
// or blog_posts (blog) via server functions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Pencil, Sparkles, Loader2, Image as ImageIcon, X, Send, Wand2,
  Megaphone, BookOpen, Newspaper, Check, ChevronLeft, ChevronRight,
  Copy, Zap, ChevronDown, Link2, Tag, Calendar as CalIcon, Save,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useAuth } from "@/lib/auth";
import { canPostEbsuNews, publishManualEbsuPost, aiAssistNews } from "@/lib/ebsu-manual-post.functions";
import { generatePostImage } from "@/lib/generate-post-image.functions";

type PostType = "news" | "announcement" | "blog";
const DRAFT_KEY = "ebsu-composer-draft-v2";

const TYPES: { key: PostType; label: string; hint: string; Icon: typeof Newspaper; color: string }[] = [
  { key: "news", label: "News", hint: "Something happening on campus", Icon: Newspaper, color: "from-primary to-sky-500" },
  { key: "announcement", label: "Announcement", hint: "Notice, memo or update", Icon: Megaphone, color: "from-amber-500 to-orange-500" },
  { key: "blog", label: "Blog", hint: "Story, guide or opinion", Icon: BookOpen, color: "from-sky-500 to-indigo-500" },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
// Convert plain-text (with blank-line paragraphs) into simple HTML so users can just type.
function textToHtml(text: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export function EbsuNewsComposer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canPost = useServerFn(canPostEbsuNews);
  const publishFn = useServerFn(publishManualEbsuPost);
  const aiFn = useServerFn(aiAssistNews);
  const genImg = useServerFn(generatePostImage);

  const { data: perms } = useQuery({
    queryKey: ["can-post-ebsu-news", user?.id],
    queryFn: () => canPost(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0 type, 1 write, 2 cover, 3 done
  const [saved, setSaved] = useState<null | { url: string }>(null);

  const [type, setType] = useState<PostType>("news");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [breaking, setBreaking] = useState(false);
  const [publish, setPublish] = useState(true);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [slugCustom, setSlugCustom] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [sourceInput, setSourceInput] = useState("");
  const [schedule, setSchedule] = useState("");

  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<"" | "title" | "body" | "summary" | "cover">("");
  const [publishing, setPublishing] = useState(false);
  const [touched, setTouched] = useState<{ title?: boolean; body?: boolean; source?: boolean; schedule?: boolean }>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const slug = slugCustom ?? slugify(title);
  const wordCount = useMemo(() => bodyText.split(/\s+/).filter(Boolean).length, [bodyText]);
  const readMins = Math.max(1, Math.round(wordCount / 220));

  // Inline validation
  const titleTrim = title.trim();
  const bodyTrim = bodyText.trim();
  const titleError =
    !titleTrim ? "Headline is required"
    : titleTrim.length < 4 ? `Add ${4 - titleTrim.length} more character${4 - titleTrim.length === 1 ? "" : "s"} (minimum 4)`
    : titleTrim.length > 180 ? "Try to keep it under 180 characters for better readability"
    : null;
  const bodyError =
    !bodyTrim ? "Your story is required"
    : bodyTrim.length < 10 ? `Write ${10 - bodyTrim.length} more character${10 - bodyTrim.length === 1 ? "" : "s"} (minimum 10)`
    : null;
  const sourceInputError = (() => {
    const v = sourceInput.trim();
    if (!v) return null;
    try { const u = new URL(v); if (!/^https?:$/.test(u.protocol)) return "Link must start with http:// or https://"; return null; }
    catch { return "That doesn't look like a valid link"; }
  })();
  const scheduleError = (() => {
    if (!schedule) return null;
    const d = new Date(schedule);
    if (isNaN(d.getTime())) return "Pick a valid date and time";
    if (d.getTime() < Date.now() - 60_000) return "Schedule must be in the future";
    return null;
  })();

  // Autosave
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, title, bodyText, imageUrl, breaking, summary, tags, sourceUrls }));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [open, type, title, bodyText, imageUrl, breaking, summary, tags, sourceUrls]);

  // Load draft
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.type) setType(d.type);
      if (!title && d.title) setTitle(d.title);
      if (!bodyText && d.bodyText) setBodyText(d.bodyText);
      if (!imageUrl && d.imageUrl) setImageUrl(d.imageUrl);
      if (typeof d.breaking === "boolean") setBreaking(d.breaking);
      if (!summary && d.summary) setSummary(d.summary);
      if (Array.isArray(d.tags) && !tags.length) setTags(d.tags);
      if (Array.isArray(d.sourceUrls) && !sourceUrls.length) setSourceUrls(d.sourceUrls);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetAll() {
    setStep(0); setType("news"); setTitle(""); setBodyText(""); setImageUrl(null);
    setBreaking(false); setPublish(true); setSummary(""); setTags([]); setSourceUrls([]);
    setSlugCustom(null); setSchedule(""); setShowAdvanced(false);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  const addTag = () => {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v || tags.includes(v) || tags.length >= 10) { setTagInput(""); return; }
    setTags((p) => [...p, v]); setTagInput("");
  };
  const addSource = () => {
    const v = sourceInput.trim();
    if (!v) return;
    try { new URL(v); } catch { toast.error("Enter a valid URL"); return; }
    if (sourceUrls.length >= 8) return;
    setSourceUrls((p) => [...p, v]); setSourceInput("");
  };

  const onFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}-cover.${ext}`;
      const { error } = await supabase.storage.from("post-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Cover uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const aiHeadline = async () => {
    const src = bodyText || title;
    if (src.trim().length < 6) return toast.info("Type a few words first");
    setAiBusy("title");
    try {
      const { text } = await aiFn({ data: { mode: "title", text: src, context: title || undefined } });
      if (text) setTitle(text.replace(/^["']|["']$/g, "").slice(0, 200));
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setAiBusy(""); }
  };
  const aiPolish = async () => {
    const src = bodyText;
    if (src.trim().length < 10) return toast.info("Write some words first");
    setAiBusy("body");
    try {
      const { text } = await aiFn({ data: { mode: "rewrite", text: src, context: title || undefined } });
      if (text) setBodyText(htmlToText(text));
      toast.success("Polished by AI");
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setAiBusy(""); }
  };
  const aiSummary = async () => {
    const src = bodyText || title;
    if (src.trim().length < 10) return toast.info("Write some words first");
    setAiBusy("summary");
    try {
      const { text } = await aiFn({ data: { mode: "summary", text: src, context: title || undefined } });
      if (text) setSummary(text.slice(0, 400));
    } catch (e: any) { toast.error(e?.message ?? "AI failed"); }
    finally { setAiBusy(""); }
  };
  const aiCover = async () => {
    const prompt = title || bodyText.slice(0, 300);
    if (!prompt) return toast.info("Add a title first");
    setAiBusy("cover");
    try {
      const { url } = await genImg({ data: { prompt: `EBSU campus news cover for: ${prompt}` } });
      setImageUrl(url);
      toast.success("AI cover ready");
    } catch (e: any) { toast.error(e?.message ?? "AI cover failed"); }
    finally { setAiBusy(""); }
  };

  const canGoNext = step === 0 ? true : step === 1 ? title.trim().length >= 4 && bodyText.trim().length >= 10 : true;

  const publishNow = async (asDraft = false) => {
    if (title.trim().length < 4) { setStep(1); return toast.error("Add a title (min 4 chars)"); }
    if (bodyText.trim().length < 10) { setStep(1); return toast.error("Write a bit more in the body"); }
    setPublishing(true);
    try {
      const html = sanitizeHtml(textToHtml(bodyText));
      const res = await publishFn({
        data: {
          type,
          title: title.trim(),
          slug: slug || undefined,
          summary: summary.trim() || undefined,
          body: html,
          imageUrl: imageUrl ?? null,
          tags: tags.length ? tags : undefined,
          sourceUrls: sourceUrls.length ? sourceUrls : undefined,
          publish: !asDraft && publish,
          breaking,
          publishAt: schedule ? new Date(schedule).toISOString() : undefined,
        },
      });
      const path = res.type === "blog" ? `/blog/${res.slug}` : `/news/${res.slug}`;
      setSaved({ url: `${window.location.origin}${path}` });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      const isPending = (res as any).status === "pending";
      if (isPending) toast.success("Submitted for review");
      else toast.success(asDraft || !publish ? "Draft saved" : "Published!");
      setStep(3);
      if (!asDraft && publish && !isPending) {
        setTimeout(() => { setOpen(false); resetAll(); setSaved(null); navigate({ to: path }); }, 1200);
      }

    } catch (e: any) {
      toast.error(e?.message ?? "Publish failed");
    } finally { setPublishing(false); }
  };

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); publishNow(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, bodyText, imageUrl, publish, breaking, schedule, type, slug, summary, tags, sourceUrls]);

  if (!perms?.allowed) return null;

  const TypeMeta = TYPES.find((t) => t.key === type)!;

  return (
    <>
      {/* Friendly FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Post to EBSU News"
        className="fixed z-40 bottom-24 right-4 sm:bottom-8 sm:right-8 group"
      >
        <span className="absolute inset-0 rounded-full bg-primary/40 blur-xl animate-pulse" aria-hidden />
        <span className={`relative flex items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-gradient-to-br ${TypeMeta.color} text-white font-bold shadow-glow hover:scale-105 active:scale-95 transition`}>
          <Pencil className="w-5 h-5" />
          <span className="text-sm">Post</span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setStep(step === 3 ? 0 : step); }}>
        <DialogContent
          onKeyDown={onKey}
          className="p-0 gap-0 overflow-hidden max-w-lg w-[calc(100vw-1rem)] sm:w-full max-h-[92vh] flex flex-col"
        >
          {/* Header with progress */}
          <div className="px-5 pt-5 pb-3 border-b bg-gradient-to-br from-primary/5 via-background to-sky-500/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TypeMeta.Icon className="w-5 h-5 text-primary" />
                <span className="font-display font-black text-base">
                  {step === 0 && "What are you sharing?"}
                  {step === 1 && "Write it"}
                  {step === 2 && "Add a cover"}
                  {step === 3 && "All done!"}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {perms?.isAdmin ? "Admin" : perms?.isTrusted ? "Trusted source" : perms?.isVerifiedSource ? "Verified source" : "Legit"}
              </span>

            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition ${i <= Math.min(step, 2) ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {step === 0 && (
              <div className="p-5 space-y-3">
                {TYPES.map((t) => {
                  const active = type === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => { setType(t.key); setStep(1); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                    >
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${t.color} flex items-center justify-center text-white shrink-0`}>
                        <t.Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold font-display">{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.hint}</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            )}

            {step === 1 && (
              <div className="p-5 space-y-4">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-bold">Headline</label>
                    <button onClick={aiHeadline} disabled={aiBusy === "title"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                      {aiBusy === "title" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Suggest
                    </button>
                  </div>
                  <Input
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Say it in one sharp line…"
                    className="text-base"
                    autoFocus
                  />
                </div>

                {/* Body — plain text */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-bold">Your story</label>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground">{wordCount} words · {readMins} min</span>
                      <button onClick={aiPolish} disabled={aiBusy === "body"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                        {aiBusy === "body" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Polish
                      </button>
                    </div>
                  </div>
                  <Textarea
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder={"Just type naturally. Leave a blank line between paragraphs.\n\nExample:\nEBSU released the new academic calendar today.\n\nExams start on…"}
                    rows={10}
                    className="text-[15px] leading-relaxed resize-none"
                  />
                </div>

                {type === "news" && (
                  <label className="flex items-center justify-between p-3 rounded-xl border bg-amber-500/5 border-amber-500/20 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm font-semibold"><Zap className="w-4 h-4 text-amber-500" /> Mark as breaking</span>
                    <Switch checked={breaking} onCheckedChange={setBreaking} />
                  </label>
                )}

                {/* Advanced */}
                <button
                  onClick={() => setShowAdvanced((s) => !s)}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground py-2"
                >
                  <span>More options</span>
                  <ChevronDown className={`w-4 h-4 transition ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                {showAdvanced && (
                  <div className="space-y-3 pt-1 border-t">
                    <div className="pt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase text-muted-foreground">Teaser</label>
                        <button onClick={aiSummary} disabled={aiBusy === "summary"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                          {aiBusy === "summary" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Auto
                        </button>
                      </div>
                      <Textarea value={summary} maxLength={400} rows={2} onChange={(e) => setSummary(e.target.value)} placeholder="1-2 sentences shown on the feed card" />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1.5"><Tag className="w-3 h-3" /> Tags</label>
                      <div className="flex gap-2">
                        <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add tag + Enter" />
                        <Button type="button" variant="outline" size="sm" onClick={addTag}>Add</Button>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {tags.map((t) => (
                            <span key={t} className="text-xs px-2 py-1 rounded-full bg-muted border flex items-center gap-1">
                              #{t}
                              <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))}><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {type !== "blog" && (
                      <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1.5"><Link2 className="w-3 h-3" /> Sources</label>
                        <div className="flex gap-2">
                          <Input value={sourceInput} onChange={(e) => setSourceInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSource())} placeholder="https://…" />
                          <Button type="button" variant="outline" size="sm" onClick={addSource}>Add</Button>
                        </div>
                        {sourceUrls.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {sourceUrls.map((u) => (
                              <li key={u} className="text-xs flex items-center gap-2 bg-muted/50 rounded px-2 py-1">
                                <span className="flex-1 truncate">{u}</span>
                                <button onClick={() => setSourceUrls((prev) => prev.filter((x) => x !== u))} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1 mb-1.5"><CalIcon className="w-3 h-3" /> Schedule</label>
                      <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">URL slug</label>
                      <Input value={slug} onChange={(e) => setSlugCustom(slugify(e.target.value))} placeholder="auto-from-title" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="p-5 space-y-4">
                <div className="rounded-2xl border-2 border-dashed bg-muted/30 overflow-hidden aspect-[16/9] flex items-center justify-center relative">
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => setImageUrl(null)} className="absolute top-2 right-2 bg-background/90 rounded-full p-1.5 hover:bg-background shadow"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground p-6">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">Pick a cover image</p>
                      <p className="text-xs">Or let AI create one for you</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-12">
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />} Upload
                  </Button>
                  <Button type="button" onClick={aiCover} disabled={aiBusy === "cover"} className="h-12 bg-gradient-to-r from-primary to-sky-500">
                    {aiBusy === "cover" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />} AI cover
                  </Button>
                </div>
                <p className="text-xs text-center text-muted-foreground">A cover is optional — you can skip it.</p>

                {/* Mini preview */}
                <div className="rounded-2xl border p-3 bg-card">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Preview</div>
                  <div className="flex gap-3">
                    {imageUrl && <img src={imageUrl} className="w-16 h-16 rounded-lg object-cover shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase text-primary">EBSU · {TypeMeta.label}</div>
                      <div className="font-bold text-sm line-clamp-2">{breaking && type === "news" ? "BREAKING: " : ""}{title || "Untitled"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && saved && (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <Check className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl">{publish ? "Published!" : "Draft saved!"}</h3>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{saved.url}</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(saved.url); toast.success("Link copied"); }}>
                    <Copy className="w-4 h-4 mr-1.5" /> Copy link
                  </Button>
                  <Button size="sm" onClick={() => { setOpen(false); resetAll(); setSaved(null); }}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          {step < 3 && (
            <div className="p-3 border-t bg-card flex items-center gap-2">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => { if (confirm("Discard this post?")) { resetAll(); setOpen(false); } }}>
                  Cancel
                </Button>
              )}
              <div className="flex-1" />
              {step === 1 && (
                <Button size="sm" onClick={() => setStep(2)} disabled={!canGoNext} className="min-w-[100px]">
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {step === 0 && (
                <Button size="sm" onClick={() => setStep(1)}>
                  Continue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {step === 2 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => publishNow(true)} disabled={publishing}>
                    {publishing && !publish ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Draft
                  </Button>
                  <Button size="sm" onClick={() => { setPublish(true); publishNow(false); }} disabled={publishing} className="bg-gradient-to-r from-primary to-sky-500 min-w-[110px]">
                    {publishing && publish ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} Publish
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
