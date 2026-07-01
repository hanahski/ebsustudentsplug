import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  ArrowLeft,
  BookOpen,
  Coins,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Check,
  Send,
  ExternalLink,
  GripVertical,
  Search,
  Link2,
  Copy,
  Sparkles,
  Wand2,
  Download,
  Eye,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { bookAiAssist } from "@/lib/book-ai.functions";
import { buildEpubBlob, downloadBlob } from "@/lib/epub-export";

const COVER_TEMPLATES: {
  id: string;
  label: string;
  bg: string;
  color: string;
  font: string;
}[] = [
  { id: "midnight", label: "Midnight", bg: "linear-gradient(135deg,#0f172a,#1e293b 60%,#334155)", color: "#f8fafc", font: "'Playfair Display', Georgia, serif" },
  { id: "ember", label: "Ember", bg: "linear-gradient(160deg,#7c2d12,#b91c1c 55%,#f59e0b)", color: "#fff7ed", font: "'Playfair Display', Georgia, serif" },
  { id: "mint", label: "Mint", bg: "linear-gradient(180deg,#064e3b,#059669 60%,#a7f3d0)", color: "#ecfdf5", font: "'Inter', system-ui, sans-serif" },
  { id: "royal", label: "Royal", bg: "linear-gradient(135deg,#312e81,#7c3aed 60%,#f0abfc)", color: "#f5f3ff", font: "'Playfair Display', Georgia, serif" },
  { id: "paper", label: "Paper", bg: "linear-gradient(180deg,#fef3c7,#fde68a 60%,#f59e0b)", color: "#1c1917", font: "'Playfair Display', Georgia, serif" },
  { id: "noir", label: "Noir", bg: "linear-gradient(180deg,#0a0a0a,#171717 70%,#404040)", color: "#fafafa", font: "'Inter', system-ui, sans-serif" },
];

async function renderTemplateCover(tpl: typeof COVER_TEMPLATES[number], title: string, author: string): Promise<Blob> {
  const w = 800, h = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Parse the gradient stops manually to keep the same look on canvas.
  const stops = tpl.bg.match(/#[0-9a-fA-F]{6}/g) ?? ["#111827", "#374151"];
  const grad = ctx.createLinearGradient(0, 0, w * 0.6, h);
  stops.forEach((s, i) => grad.addColorStop(i / Math.max(1, stops.length - 1), s));
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  // Subtle frame
  ctx.strokeStyle = tpl.color + "33"; ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  ctx.fillStyle = tpl.color;
  ctx.textAlign = "center";
  ctx.font = `700 76px ${tpl.font}`;
  // Word-wrap title
  const words = (title || "Untitled").split(/\s+/);
  const lines: string[] = []; let line = "";
  for (const w0 of words) {
    const test = line ? line + " " + w0 : w0;
    if (ctx.measureText(test).width > w - 160 && line) { lines.push(line); line = w0; } else line = test;
  }
  if (line) lines.push(line);
  const startY = h / 2 - (lines.length - 1) * 44;
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, startY + i * 88));
  ctx.font = `400 32px ${tpl.font}`;
  ctx.fillText((author || "").toUpperCase(), w / 2, h - 120);
  return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
}



export const Route = createFileRoute("/books_/composer/$bookId")({ component: ComposerEditorPage });

type Chapter = { id: string; book_id: string; idx: number; title: string; content: string };
type Book = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  book_type: string;
  status: string;
  price_credits: number;
  library_book_id: string | null;
  share_token: string | null;
};

function stripHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]+>/g, " ");
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.innerText || d.textContent || "";
}

function ComposerEditorPage() {
  const { bookId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findTerm, setFindTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [creatingShare, setCreatingShare] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [applyingTpl, setApplyingTpl] = useState<string | null>(null);
  const aiAssistFn = useServerFn(bookAiAssist);




  const { data: book, isLoading: bookLoading } = useQuery<Book | null>({
    queryKey: ["composer-book", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_books")
        .select("*")
        .eq("id", bookId)
        .maybeSingle();
      if (error) throw error;
      return data as Book | null;
    },
  });

  const { data: chapters, isLoading: chLoading } = useQuery<Chapter[]>({
    queryKey: ["composer-chapters", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_book_chapters")
        .select("*")
        .eq("book_id", bookId)
        .order("idx");
      if (error) throw error;
      return (data ?? []) as Chapter[];
    },
  });

  useEffect(() => {
    if (chapters && chapters.length > 0 && !activeId) setActiveId(chapters[0].id);
  }, [chapters, activeId]);

  const active = useMemo(
    () => chapters?.find((c) => c.id === activeId) ?? null,
    [chapters, activeId],
  );

  // ---------- Local edit buffer + debounced autosave ----------
  const [meta, setMeta] = useState({ title: "", subtitle: "", description: "", price_credits: 0 });
  useEffect(() => {
    if (book)
      setMeta({
        title: book.title ?? "",
        subtitle: book.subtitle ?? "",
        description: book.description ?? "",
        price_credits: book.price_credits ?? 0,
      });
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [chBuf, setChBuf] = useState<{ title: string; content: string }>({
    title: "",
    content: "",
  });
  useEffect(() => {
    if (active) setChBuf({ title: active.title, content: active.content });
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveTimers = useRef<Record<"meta" | "chapter", ReturnType<typeof setTimeout> | null>>({
    meta: null,
    chapter: null,
  });
  const queueSave = useCallback((key: "meta" | "chapter", fn: () => Promise<void>) => {
    const existing = saveTimers.current[key];
    if (existing) clearTimeout(existing);
    saveTimers.current[key] = setTimeout(async () => {
      setSaving(true);
      try {
        await fn();
        setSavedAt(new Date());
      } catch (e: any) {
        toast.error(e?.message ?? "Save failed");
      } finally {
        setSaving(false);
      }
    }, 800);
  }, []);

  useEffect(
    () => () => {
      if (saveTimers.current.meta) clearTimeout(saveTimers.current.meta);
      if (saveTimers.current.chapter) clearTimeout(saveTimers.current.chapter);
    },
    [],
  );

  // Persist book meta
  useEffect(() => {
    if (!book) return;
    if (
      meta.title === (book.title ?? "") &&
      meta.subtitle === (book.subtitle ?? "") &&
      meta.description === (book.description ?? "") &&
      meta.price_credits === book.price_credits
    )
      return;
    queueSave("meta", async () => {
      const { error } = await supabase
        .from("user_books")
        .update({
          title: meta.title || "Untitled",
          subtitle: meta.subtitle || null,
          description: meta.description || null,
          price_credits: Math.max(0, Math.floor(meta.price_credits || 0)),
        })
        .eq("id", bookId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["composer-book", bookId] });
    });
  }, [meta, book, bookId, queueSave, qc]);

  // Persist chapter
  useEffect(() => {
    if (!active) return;
    if (chBuf.title === active.title && chBuf.content === active.content) return;
    queueSave("chapter", async () => {
      const { error } = await supabase
        .from("user_book_chapters")
        .update({
          title: chBuf.title || "Untitled",
          content: chBuf.content,
        })
        .eq("id", active.id);
      if (error) throw error;
      qc.setQueryData<Chapter[]>(["composer-chapters", bookId], (prev) =>
        (prev ?? []).map((c) =>
          c.id === active.id ? { ...c, title: chBuf.title, content: chBuf.content } : c,
        ),
      );
    });
  }, [chBuf, active, bookId, queueSave, qc]);

  // ---------- Chapter actions ----------
  const addChapter = useMutation({
    mutationFn: async () => {
      const next = chapters?.length ?? 0;
      const { data, error } = await supabase
        .from("user_book_chapters")
        .insert({ book_id: bookId, idx: next, title: `Chapter ${next + 1}`, content: "" })
        .select("*")
        .single();
      if (error) throw error;
      return data as Chapter;
    },
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["composer-chapters", bookId] });
      setActiveId(c.id);
    },
  });

  const deleteChapter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_book_chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["composer-chapters", bookId] });
    },
  });

  // ---------- Drag-reorder chapters ----------
  const reorderChapters = useMutation({
    mutationFn: async (ordered: Chapter[]) => {
      // Persist new idx values in a single round-trip per chapter.
      const updates = ordered.map((c, i) =>
        supabase.from("user_book_chapters").update({ idx: i }).eq("id", c.id),
      );
      const results = await Promise.all(updates);
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["composer-chapters", bookId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDrop = (targetId: string) => {
    if (!dragId || !chapters || dragId === targetId) return;
    const src = chapters.findIndex((c) => c.id === dragId);
    const dst = chapters.findIndex((c) => c.id === targetId);
    if (src < 0 || dst < 0) return;
    const next = [...chapters];
    const [moved] = next.splice(src, 1);
    next.splice(dst, 0, moved);
    qc.setQueryData<Chapter[]>(["composer-chapters", bookId], next.map((c, i) => ({ ...c, idx: i })));
    reorderChapters.mutate(next);
    setDragId(null);
  };

  // ---------- Word count + reading time (active chapter) ----------
  const wordStats = useMemo(() => {
    const text = stripHtml(chBuf.content).trim();
    const words = text ? text.split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.round(words / 220));
    return { words, minutes };
  }, [chBuf.content]);

  // ---------- Find & replace across ALL chapters ----------
  const runReplace = async () => {
    if (!findTerm || !chapters) return;
    const re = new RegExp(findTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    let touched = 0;
    for (const c of chapters) {
      if (!re.test(c.content)) { re.lastIndex = 0; continue; }
      re.lastIndex = 0;
      const nextContent = c.content.replace(re, replaceTerm);
      const { error } = await supabase
        .from("user_book_chapters")
        .update({ content: nextContent })
        .eq("id", c.id);
      if (error) { toast.error(error.message); return; }
      touched += 1;
      if (c.id === activeId) setChBuf((b) => ({ ...b, content: nextContent }));
    }
    qc.invalidateQueries({ queryKey: ["composer-chapters", bookId] });
    toast.success(touched ? `Replaced in ${touched} chapter${touched === 1 ? "" : "s"}` : "No matches");
    setFindOpen(false);
  };

  // ---------- Collaborator share link ----------
  const previewUrl = book?.share_token
    ? (typeof window !== "undefined" ? window.location.origin : "") + `/books/preview/${book.share_token}`
    : "";
  const ensureShareToken = async () => {
    if (!book) return;
    if (book.share_token) { setShareOpen(true); return; }
    setCreatingShare(true);
    const token = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, "");
    const { error } = await supabase
      .from("user_books")
      .update({ share_token: token } as any)
      .eq("id", bookId);
    setCreatingShare(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["composer-book", bookId] });
    setShareOpen(true);
  };
  const revokeShare = async () => {
    if (!book?.share_token) return;
    const { error } = await supabase
      .from("user_books")
      .update({ share_token: null } as any)
      .eq("id", bookId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["composer-book", bookId] });
    toast.success("Share link revoked");
    setShareOpen(false);
  };
  const copyShare = async () => {
    if (!previewUrl) return;
    try { await navigator.clipboard.writeText(previewUrl); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };


  const coverInput = useRef<HTMLInputElement | null>(null);
  const onPickCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sign in");
      return;
    }
    const path = `${u.user.id}/covers/${bookId}-${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("book-covers").upload(path, f, { upsert: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    // Private bucket — sign the URL so readers can actually see the cover.
    const { data: signed, error: se } = await supabase.storage
      .from("book-covers")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (se || !signed?.signedUrl) {
      toast.error(se?.message ?? "Could not get cover URL");
      return;
    }
    const { error: ue } = await supabase
      .from("user_books")
      .update({ cover_url: signed.signedUrl })
      .eq("id", bookId);
    if (ue) {
      toast.error(ue.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["composer-book", bookId] });
    toast.success("Cover updated");
  };

  // ---------- Publish ----------
  const publish = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("publish_user_book", { _book_id: bookId });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (libId) => {
      qc.invalidateQueries({ queryKey: ["composer-book", bookId] });
      qc.invalidateQueries({ queryKey: ["library-books"] });
      toast.success("Published to Book Plug!", {
        action: {
          label: "View",
          onClick: () => router.navigate({ to: "/books/read/$id", params: { id: libId } }),
        },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (bookLoading || chLoading) {
    return (
      <AppShell>
        <p className="text-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 inline animate-spin" /> Loading…
        </p>
      </AppShell>
    );
  }
  if (!book) {
    return (
      <AppShell>
        <div className="text-center py-16">
          <p>Book not found.</p>
          <Button asChild className="mt-3">
            <Link to="/books/composer">Back</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button size="sm" variant="ghost" asChild>
            <Link to="/books/composer">
              <ArrowLeft className="w-4 h-4 mr-1" /> My books
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </>
            ) : savedAt ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" /> Saved {savedAt.toLocaleTimeString()}
              </>
            ) : null}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setFindOpen(true)} title="Find & replace (all chapters)">
              <Search className="w-4 h-4 mr-1" /> Find
            </Button>
            <Button size="sm" variant="outline" onClick={ensureShareToken} disabled={creatingShare} title="Share a read-only preview link">
              {creatingShare ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Link2 className="w-4 h-4 mr-1" />}
              Share draft
            </Button>
            {book.status === "published" && book.library_book_id && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/books/read/$id" params={{ id: book.library_book_id }}>
                  <ExternalLink className="w-4 h-4 mr-1" /> View
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              disabled={publish.isPending}
              onClick={() => publish.mutate()}
              className="bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground"
            >
              {publish.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              {book.status === "published" ? "Re-publish" : "Publish to Book Plug"}
            </Button>
          </div>
        </div>


        {/* Book meta */}
        <div className="bg-card border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
          <div>
            <div className="aspect-[2/3] bg-muted rounded-xl overflow-hidden">
              <BookCover title={book.title} src={book.cover_url} className="h-full w-full" />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full mt-2"
              onClick={() => coverInput.current?.click()}
            >
              <Upload className="w-3.5 h-3.5 mr-1" /> Cover
            </Button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickCover}
            />
          </div>
          <div className="space-y-2">
            <Input
              value={meta.title}
              onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
              placeholder="Book title"
              className="text-lg font-bold"
            />
            <Input
              value={meta.subtitle}
              onChange={(e) => setMeta((m) => ({ ...m, subtitle: e.target.value }))}
              placeholder="Subtitle (optional)"
            />
            <Textarea
              value={meta.description}
              onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
              placeholder="Short description / blurb"
              rows={2}
            />
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-primary" />
              <Input
                type="number"
                min={0}
                value={meta.price_credits}
                onChange={(e) => setMeta((m) => ({ ...m, price_credits: Number(e.target.value) }))}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">credits to unlock (0 = free)</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
                {book.book_type}
              </span>
            </div>
          </div>
        </div>

        {/* Editor + chapters */}
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          <aside className="bg-card border rounded-2xl p-3 space-y-1 h-fit md:sticky md:top-20">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Chapters
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => addChapter.mutate()}
                title="Add chapter"
                disabled={addChapter.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {(chapters ?? []).map((c, i) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDragId(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(c.id)}
                onDragEnd={() => setDragId(null)}
                className={`group flex items-center gap-1 rounded-lg pr-1 ${dragId === c.id ? "opacity-40" : ""}`}
              >
                <span className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground pl-1" title="Drag to reorder">
                  <GripVertical className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`flex-1 text-left px-1 py-1.5 rounded-lg text-sm flex items-center gap-2 ${activeId === c.id ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted"}`}
                >
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <span className="flex-1 truncate">{c.title || "Untitled"}</span>
                </button>
              </div>
            ))}
            {(chapters?.length ?? 0) === 0 && (
              <p className="text-xs text-muted-foreground p-2">No chapters yet.</p>
            )}
          </aside>


          <section className="space-y-3">
            {active ? (
              <>
                <div className="flex items-center gap-2">
                  <Input
                    value={chBuf.title}
                    onChange={(e) => setChBuf((b) => ({ ...b, title: e.target.value }))}
                    placeholder="Chapter title"
                    className="text-base font-semibold"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this chapter?")) deleteChapter.mutate(active.id);
                    }}
                    title="Delete chapter"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <RichTextEditor
                  value={chBuf.content}
                  onChange={(html) => setChBuf((b) => ({ ...b, content: html }))}
                  placeholder="Start writing your chapter…"
                />
                <div className="text-xs text-muted-foreground flex items-center justify-end gap-3 px-1">
                  <span><b>{wordStats.words.toLocaleString()}</b> words</span>
                  <span>·</span>
                  <span>~{wordStats.minutes} min read</span>
                </div>
              </>

            ) : (
              <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  Pick a chapter on the left or add a new one to start writing.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Find & replace across all chapters */}
      <Dialog open={findOpen} onOpenChange={setFindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Find & replace</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold">Find</label>
              <Input value={findTerm} onChange={(e) => setFindTerm(e.target.value)} placeholder="Text to find (case-insensitive)" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold">Replace with</label>
              <Input value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} placeholder="Replacement (leave empty to delete matches)" />
            </div>
            <p className="text-xs text-muted-foreground">Runs across every chapter in this book. Cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFindOpen(false)}>Cancel</Button>
            <Button onClick={runReplace} disabled={!findTerm}>Replace all</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share draft link */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share draft preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Anyone with this link can read the current draft (no sign-in). Revoke anytime.</p>
            <div className="flex gap-2">
              <Input readOnly value={previewUrl} className="font-mono text-xs" />
              <Button size="icon" variant="outline" onClick={copyShare} title="Copy link"><Copy className="w-4 h-4" /></Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={revokeShare}>Revoke link</Button>
            <Button onClick={() => setShareOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );

}
