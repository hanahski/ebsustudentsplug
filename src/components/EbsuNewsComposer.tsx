// EBSU News Composer — FAB + full-featured composer for news / announcements / blog.
// Visible only to admins and legit-badge users. Publishes to news_articles (news/announcement)
// or blog_posts (blog) via server functions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus, Sparkles, Loader2, Image as ImageIcon, X, Tag, Link2, Send, FileText,
  Megaphone, BookOpen, Newspaper, Wand2, Zap, Eye, EyeOff, Maximize2, Minimize2,
  Save, Trash2, Calendar as CalIcon, Info, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { RichTextEditor } from "@/components/RichTextEditor";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { useAuth } from "@/lib/auth";
import { canPostEbsuNews, publishManualEbsuPost, aiAssistNews } from "@/lib/ebsu-manual-post.functions";
import { generatePostImage } from "@/lib/generate-post-image.functions";

type PostType = "news" | "announcement" | "blog";
const DRAFT_KEY = "ebsu-composer-draft-v1";

const TEMPLATES: Record<string, { title: string; body: string; summary?: string; type?: PostType }> = {
  memo: {
    title: "Notice: [Subject]",
    summary: "Official notice from the [Department] to all EBSU students.",
    body: `<p><strong>To:</strong> All EBSU Students</p><p><strong>From:</strong> [Sender]</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><h2>Notice</h2><p>[Write the body of the notice here.]</p><p>Signed,<br/>[Name]</p>`,
    type: "announcement",
  },
  breaking: {
    title: "BREAKING: [What happened]",
    summary: "Fresh update from campus. Details still coming in.",
    body: `<p><em>Developing story — updated at ${new Date().toLocaleTimeString()}.</em></p><h2>What we know</h2><ul><li>[Fact 1]</li><li>[Fact 2]</li></ul><h2>What's next</h2><p>[Context / next steps.]</p>`,
    type: "news",
  },
  exam: {
    title: "Exam Timetable Update — [Faculty / Level]",
    summary: "Updated exam schedule for [Faculty / Level].",
    body: `<h2>Highlights</h2><ul><li>[Course code — date, time, venue]</li><li>[Course code — date, time, venue]</li></ul><h2>Instructions</h2><ol><li>Arrive 30 minutes early.</li><li>Bring your ID card.</li></ol>`,
    type: "announcement",
  },
  blogPost: {
    title: "[Your blog title]",
    summary: "A short teaser for the article.",
    body: `<h2>Intro</h2><p>[Hook the reader.]</p><h2>Body</h2><p>[Main content.]</p><h2>Takeaway</h2><p>[Close it out.]</p>`,
    type: "blog",
  },
};

const TYPE_META: Record<PostType, { label: string; Icon: typeof Newspaper; accent: string }> = {
  news: { label: "News", Icon: Newspaper, accent: "text-primary" },
  announcement: { label: "Announcement", Icon: Megaphone, accent: "text-amber-500" },
  blog: { label: "Blog", Icon: BookOpen, accent: "text-sky-500" },
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  const [full, setFull] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState<null | { url: string }>(null);

  // Fields
  const [type, setType] = useState<PostType>("news");
  const [title, setTitle] = useState("");
  const [slugCustom, setSlugCustom] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([]);
  const [sourceInput, setSourceInput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [publish, setPublish] = useState(true);
  const [breaking, setBreaking] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState<"" | "title" | "summary" | "rewrite" | "expand" | "cover">("");
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const slug = slugCustom ?? slugify(title);
  const wordCount = useMemo(() => stripHtml(body).split(/\s+/).filter(Boolean).length, [body]);
  const readMins = Math.max(1, Math.round(wordCount / 220));

  // Autosave draft
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ type, title, summary, body, tags, sourceUrls, imageUrl, breaking }));
      } catch {}
    }, 800);
    return () => clearTimeout(t);
  }, [open, type, title, summary, body, tags, sourceUrls, imageUrl, breaking]);

  // Load draft on first open
  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!title && d.title) setTitle(d.title);
      if (!body && d.body) setBody(d.body);
      if (!summary && d.summary) setSummary(d.summary);
      if (d.type) setType(d.type);
      if (Array.isArray(d.tags) && !tags.length) setTags(d.tags);
      if (Array.isArray(d.sourceUrls) && !sourceUrls.length) setSourceUrls(d.sourceUrls);
      if (d.imageUrl && !imageUrl) setImageUrl(d.imageUrl);
      if (typeof d.breaking === "boolean") setBreaking(d.breaking);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearDraft = () => {
    if (!confirm("Clear the composer and delete the saved draft?")) return;
    setTitle(""); setSummary(""); setBody(""); setTags([]); setSourceUrls([]);
    setImageUrl(null); setSlugCustom(null); setBreaking(false); setSchedule("");
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    toast.success("Draft cleared");
  };

  const applyTemplate = (key: keyof typeof TEMPLATES) => {
    const t = TEMPLATES[key];
    if (t.type) setType(t.type);
    setTitle(t.title);
    if (t.summary) setSummary(t.summary);
    setBody(t.body);
    toast.success("Template applied");
  };

  const addTag = () => {
    const v = tagInput.trim().replace(/^#/, "");
    if (!v) return;
    if (tags.includes(v)) { setTagInput(""); return; }
    if (tags.length >= 10) { toast.warning("Max 10 tags"); return; }
    setTags((prev) => [...prev, v]);
    setTagInput("");
  };
  const addSource = () => {
    const v = sourceInput.trim();
    if (!v) return;
    try { new URL(v); } catch { toast.error("Enter a valid URL"); return; }
    if (sourceUrls.length >= 8) { toast.warning("Max 8 sources"); return; }
    setSourceUrls((prev) => [...prev, v]);
    setSourceInput("");
  };

  const onFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    if (file.size > 8 * 1024 * 1024) return toast.error("Image must be under 8 MB");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}-cover.${ext}`;
      const { error } = await supabase.storage.from("post-images").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("post-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Cover uploaded");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally { setUploading(false); }
  };

  const aiRun = async (mode: "title" | "summary" | "rewrite" | "expand") => {
    const src = mode === "title" || mode === "summary"
      ? (stripHtml(body) || title)
      : mode === "expand" ? (stripHtml(body) || title || summary) : body;
    if (!src || src.length < 4) return toast.info("Write a bit first, then let AI help");
    setAiBusy(mode);
    try {
      const { text } = await aiFn({ data: { mode, text: src, context: title || undefined } });
      if (!text) throw new Error("No output");
      if (mode === "title") setTitle(text.replace(/^["']|["']$/g, "").slice(0, 200));
      else if (mode === "summary") setSummary(text.slice(0, 400));
      else setBody(sanitizeHtml(text));
      toast.success(`AI ${mode} ready`);
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally { setAiBusy(""); }
  };

  const aiCover = async () => {
    const prompt = summary || stripHtml(body).slice(0, 300) || title;
    if (!prompt) return toast.info("Add a title or body first");
    setAiBusy("cover");
    try {
      const { url } = await genImg({ data: { prompt: `EBSU campus news cover for: ${prompt}` } });
      setImageUrl(url);
      toast.success("AI cover generated");
    } catch (e: any) {
      toast.error(e?.message ?? "AI cover failed");
    } finally { setAiBusy(""); }
  };

  const publishNow = async () => {
    if (title.trim().length < 4) return toast.error("Title needs at least 4 characters");
    if (stripHtml(body).length < 10) return toast.error("Body is too short");
    setPublishing(true);
    try {
      const res = await publishFn({
        data: {
          type,
          title: title.trim(),
          slug: slug || undefined,
          summary: summary.trim() || undefined,
          body,
          imageUrl: imageUrl ?? null,
          tags: tags.length ? tags : undefined,
          sourceUrls: sourceUrls.length ? sourceUrls : undefined,
          publish,
          breaking,
          publishAt: schedule ? new Date(schedule).toISOString() : undefined,
        },
      });
      const path = res.type === "blog" ? `/blog/${res.slug}` : `/news/${res.slug}`;
      setSaved({ url: `${window.location.origin}${path}` });
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      toast.success(publish ? "Published!" : "Draft saved");
      setTimeout(() => {
        setOpen(false);
        setSaved(null);
        setTitle(""); setSummary(""); setBody(""); setTags([]); setSourceUrls([]); setImageUrl(null); setBreaking(false); setSlugCustom(null); setSchedule("");
        if (publish) navigate({ to: path });
      }, 900);
    } catch (e: any) {
      toast.error(e?.message ?? "Publish failed");
    } finally { setPublishing(false); }
  };

  // Keyboard shortcuts: Ctrl/Cmd+Enter publish, Ctrl/Cmd+S save draft, Esc close
  const onKey = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); publishNow(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); setPublish(false); publishNow(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, summary, tags, sourceUrls, imageUrl, publish, breaking, schedule, type, slug]);

  if (!perms?.allowed) return null;
  const TypeIcon = TYPE_META[type].Icon;

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Compose EBSU news"
        className="fixed z-40 bottom-24 right-4 sm:bottom-8 sm:right-8 w-14 h-14 rounded-full bg-gradient-to-br from-primary via-primary to-sky-500 text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition"
      >
        <Plus className="w-6 h-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onKeyDown={onKey}
          className={`p-0 gap-0 overflow-hidden ${full ? "max-w-none w-screen h-screen sm:rounded-none" : "max-w-3xl"}`}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b bg-gradient-to-r from-primary/5 via-transparent to-sky-500/5">
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                <TypeIcon className={`w-5 h-5 ${TYPE_META[type].accent}`} />
                <span className="font-display font-black">Compose {TYPE_META[type].label}</span>
                {perms?.isAdmin && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Admin</span>}
                {!perms?.isAdmin && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Legit</span>}
              </span>
              <span className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" onClick={() => setPreview((p) => !p)} title={preview ? "Edit" : "Preview"}>
                  {preview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setFull((f) => !f)} title={full ? "Exit full-screen" : "Full-screen"}>
                  {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className={`overflow-y-auto ${full ? "flex-1" : "max-h-[75vh]"}`}>
            {saved ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center"><Check className="w-7 h-7" /></div>
                <h3 className="font-display font-black text-xl">{publish ? "Published!" : "Draft saved!"}</h3>
                <p className="text-sm text-muted-foreground break-all">{saved.url}</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(saved.url); toast.success("Link copied"); }}>
                    <Copy className="w-4 h-4 mr-1.5" /> Copy link
                  </Button>
                </div>
              </div>
            ) : preview ? (
              <article className="p-6 max-w-2xl mx-auto">
                {imageUrl && <img src={imageUrl} alt="" className="w-full rounded-2xl mb-4 aspect-[16/9] object-cover" />}
                <div className="text-xs font-bold uppercase text-primary mb-2">{TYPE_META[type].label} · {readMins} min read</div>
                <h1 className="text-3xl font-black font-display leading-tight mb-2">{breaking && type === "news" && !title.toUpperCase().startsWith("BREAKING") ? "BREAKING: " : ""}{title || "Untitled"}</h1>
                {summary && <p className="text-lg text-muted-foreground mb-4">{summary}</p>}
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeHtml(body) }} />
              </article>
            ) : (
              <div className="p-5 space-y-5">
                {/* Type + templates */}
                <div className="space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(TYPE_META) as PostType[]).map((k) => {
                      const M = TYPE_META[k];
                      const active = type === k;
                      return (
                        <button
                          key={k}
                          onClick={() => setType(k)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground border-primary shadow-glow" : "bg-card hover:bg-accent"}`}
                        >
                          <M.Icon className="w-3.5 h-3.5" /> {M.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground self-center">Templates:</span>
                    <button onClick={() => applyTemplate("breaking")} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent border">⚡ Breaking</button>
                    <button onClick={() => applyTemplate("memo")} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent border">📄 Official memo</button>
                    <button onClick={() => applyTemplate("exam")} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent border">📚 Exam update</button>
                    <button onClick={() => applyTemplate("blogPost")} className="text-xs px-2.5 py-1 rounded-full bg-muted hover:bg-accent border">📝 Blog post</button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Title <span className="text-muted-foreground text-[11px]">({title.length}/200)</span></Label>
                    <button onClick={() => aiRun("title")} disabled={aiBusy === "title"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                      {aiBusy === "title" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI headline
                    </button>
                  </div>
                  <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Write a sharp headline…" />
                </div>

                {/* Slug */}
                <div>
                  <Label>URL slug <span className="text-muted-foreground text-[11px]">(auto)</span></Label>
                  <Input value={slug} onChange={(e) => setSlugCustom(slugify(e.target.value))} placeholder="auto-generated-from-title" />
                </div>

                {/* Summary */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Summary <span className="text-muted-foreground text-[11px]">({summary.length}/400)</span></Label>
                    <button onClick={() => aiRun("summary")} disabled={aiBusy === "summary"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                      {aiBusy === "summary" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} AI summary
                    </button>
                  </div>
                  <Textarea value={summary} maxLength={400} rows={2} onChange={(e) => setSummary(e.target.value)} placeholder="1-2 sentence teaser for feed cards and search…" />
                </div>

                {/* Cover image */}
                <div>
                  <Label>Cover image</Label>
                  <div className="mt-1 grid grid-cols-[1fr_auto] gap-2 items-start">
                    <div className="border rounded-2xl overflow-hidden bg-muted/40 aspect-[16/9] flex items-center justify-center">
                      {imageUrl ? (
                        <div className="relative w-full h-full">
                          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => setImageUrl(null)} className="absolute top-2 right-2 bg-background/80 rounded-full p-1 hover:bg-background"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground text-xs p-4">
                          <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                          No cover yet
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1" />} Upload
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={aiCover} disabled={aiBusy === "cover"}>
                        {aiBusy === "cover" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />} AI cover
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Body <span className="text-muted-foreground text-[11px]">· {wordCount} words · {readMins} min read</span></Label>
                    <div className="flex gap-2">
                      <button onClick={() => aiRun("expand")} disabled={aiBusy === "expand"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                        {aiBusy === "expand" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Expand
                      </button>
                      <button onClick={() => aiRun("rewrite")} disabled={aiBusy === "rewrite"} className="text-[11px] flex items-center gap-1 text-primary font-semibold hover:underline disabled:opacity-50">
                        {aiBusy === "rewrite" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />} Polish
                      </button>
                    </div>
                  </div>
                  <RichTextEditor value={body} onChange={setBody} placeholder="Write your story…" minHeight={280} />
                </div>

                {/* Tags */}
                <div>
                  <Label className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Tags</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} placeholder="Add a tag and press Enter" />
                    <Button type="button" variant="outline" onClick={addTag}>Add</Button>
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

                {/* Sources */}
                {type !== "blog" && (
                  <div>
                    <Label className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Sources / references</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={sourceInput} onChange={(e) => setSourceInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSource())} placeholder="https://…" />
                      <Button type="button" variant="outline" onClick={addSource}>Add</Button>
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

                {/* Meta grid */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold"><Send className="w-3.5 h-3.5" /> Publish now</div>
                      <div className="text-[11px] text-muted-foreground">Off = save as draft</div>
                    </div>
                    <Switch checked={publish} onCheckedChange={setPublish} />
                  </div>
                  {type === "news" && (
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold"><Zap className="w-3.5 h-3.5 text-amber-500" /> Breaking</div>
                        <div className="text-[11px] text-muted-foreground">Prefixes title with BREAKING</div>
                      </div>
                      <Switch checked={breaking} onCheckedChange={setBreaking} />
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <Label className="flex items-center gap-1 text-xs"><CalIcon className="w-3.5 h-3.5" /> Schedule (optional)</Label>
                    <Input type="datetime-local" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
                  <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>Shortcuts: <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> publish · <kbd>⌘/Ctrl</kbd>+<kbd>S</kbd> save draft. Autosaves every second — reload safe.</span>
                </div>
              </div>
            )}
          </div>

          {!saved && (
            <div className="p-4 border-t bg-card flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={clearDraft} className="text-muted-foreground">
                <Trash2 className="w-4 h-4 mr-1" /> Clear
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setPublish(false); publishNow(); }} disabled={publishing}>
                {publishing && !publish ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save draft
              </Button>
              <Button onClick={() => { setPublish(true); publishNow(); }} disabled={publishing} className="bg-gradient-to-r from-primary to-sky-500">
                {publishing && publish ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                Publish
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
