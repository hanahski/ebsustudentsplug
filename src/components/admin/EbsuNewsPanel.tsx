import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  listSources,
  upsertSource,
  deleteSource,
  generateEbsuNews,
  deleteNewsArticle,
  regenerateEbsuNews,
  generateCoverForArticle,
} from "@/lib/ebsu-news.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Sparkles, Newspaper, ExternalLink, RotateCw, Wand2, ImagePlus } from "lucide-react";
import { NewsSubmissionsPanel, VerifiedSourcesPanel } from "./NewsSubmissionsPanel";


export function EbsuNewsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listSources);
  const upsert = useServerFn(upsertSource);
  const del = useServerFn(deleteSource);
  const gen = useServerFn(generateEbsuNews);
  const delArt = useServerFn(deleteNewsArticle);
  const remakeArt = useServerFn(regenerateEbsuNews);
  const genCover = useServerFn(generateCoverForArticle);
  const [remakingId, setRemakingId] = useState<string | null>(null);
  const [remakingAll, setRemakingAll] = useState(false);
  const [coveringId, setCoveringId] = useState<string | null>(null);
  const [replacingAllCovers, setReplacingAllCovers] = useState(false);

  const { data: sources = [], isLoading: srcLoading } = useQuery({
    queryKey: ["ebsu-sources"],
    queryFn: () => list(),
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["ebsu-news-articles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id, title, slug, status, image_url, published_at")
        .eq("category", "ebsu")
        .order("published_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [pasted, setPasted] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);

  async function addSource() {
    if (!newUrl.trim()) return;
    try {
      await upsert({ data: { url: newUrl.trim(), label: newLabel.trim() || undefined, weight: 1, is_active: true } });
      setNewUrl(""); setNewLabel("");
      toast.success("Source added");
      qc.invalidateQueries({ queryKey: ["ebsu-sources"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function toggleSource(s: any) {
    try {
      await upsert({ data: { id: s.id, url: s.url, label: s.label, weight: s.weight, is_active: !s.is_active } });
      qc.invalidateQueries({ queryKey: ["ebsu-sources"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function removeSource(id: string) {
    if (!(await confirm({ title: "Remove this source?", description: "They will lose the Verified Source badge.", variant: "destructive", confirmText: "Remove source" }))) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["ebsu-sources"] });
  }

  async function generate(publish: boolean) {
    setBusy(true);
    try {
      const p = pasted.trim();
      const i = instruction.trim();
      let topic: string | undefined;
      if (p && i) {
        topic = `INSTRUCTION FROM EDITOR:\n${i}\n\nPASTED CONTENT (apply the instruction above to this text):\n"""\n${p}\n"""`;
      } else if (p) {
        topic = `PASTED CONTENT (rewrite into an original EBSU Plug News article — do not copy verbatim):\n"""\n${p}\n"""`;
      } else if (i) {
        topic = i;
      }
      const r = await gen({ data: { topic, publish } });
      toast.success(publish ? "EBSU news published!" : "Draft created");
      setPasted("");
      setInstruction("");
      qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
      console.log("generated", r);
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed");
    } finally { setBusy(false); }
  }

  async function removeArticle(id: string) {
    if (!(await confirm({ title: "Delete this article?", description: "It will be removed from EBSU News.", variant: "destructive", confirmText: "Delete article", icon: "trash" }))) return;
    await delArt({ data: { id } });
    qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
  }

  async function remakeOne(id: string) {
    setRemakingId(id);
    try {
      await remakeArt({ data: { id } });
      toast.success("Article remade with updated AI");
      qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Remake failed");
    } finally {
      setRemakingId(null);
    }
  }

  async function generateCover(id: string) {
    setCoveringId(id);
    try {
      await genCover({ data: { id } });
      toast.success("Cover image generated");
      qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Cover generation failed");
    } finally {
      setCoveringId(null);
    }
  }



  async function replaceAllCovers() {
    if (!articles.length) return;
    if (!(await confirm({ title: `Replace ${articles.length} cover images?`, description: "Every cover image will be regenerated with the trained news AI. Article bodies stay the same.", confirmText: "Replace covers" }))) return;
    setReplacingAllCovers(true);
    let ok = 0, fail = 0;
    for (const a of articles as any[]) {
      setCoveringId(a.id);
      try {
        await genCover({ data: { id: a.id } });
        ok++;
      } catch (e: any) {
        fail++;
        console.error("cover failed", a.id, e);
      }
    }
    setCoveringId(null);
    setReplacingAllCovers(false);
    qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
    toast[fail ? "warning" : "success"](`Replaced ${ok}/${articles.length}${fail ? ` (${fail} failed)` : ""}`);
  }



  async function remakeAll() {
    if (!articles.length) return;
    if (!(await confirm({ title: `Remake all ${articles.length} articles?`, description: "This rewrites every body and regenerates cover images with the updated AI.", confirmText: "Remake all" }))) return;
    setRemakingAll(true);
    let ok = 0, fail = 0;
    for (const a of articles as any[]) {
      setRemakingId(a.id);
      try {
        await remakeArt({ data: { id: a.id } });
        ok++;
      } catch (e: any) {
        fail++;
        console.error("remake failed", a.id, e);
      }
    }
    setRemakingId(null);
    setRemakingAll(false);
    qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] });
    toast[fail ? "warning" : "success"](`Remade ${ok}/${articles.length}${fail ? ` (${fail} failed)` : ""}`);
  }

  return (
    <div className="space-y-5">
      <NewsSubmissionsPanel />
      <VerifiedSourcesPanel />

      {/* Composer */}

      <div className="bg-card border rounded-3xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-bold font-display text-lg">Smart EBSU News Composer</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Paste text, drop links, or give commands like "fetch this link and summarize", "filter out X", "rewrite as a 5-point explainer", or "don't post if it's not newsworthy". You can also drop an image URL (.jpg / .png / .webp) and the AI will blend it into the cover — every cover is auto-branded with the StudentsPlug logo.
        </p>

        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pasted text (optional)</label>
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste the raw article, press release, WhatsApp broadcast, or notes here…"
          rows={6}
          className="mt-1 mb-3"
        />

        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your prompt / command</label>
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder='e.g. "Rewrite this as breaking news for EBSU students", "Summarize and add what it means for 300-level students", "Turn into a 5-point explainer".'
          rows={3}
          className="mt-1 mb-3"
        />

        <div className="flex gap-2">
          <Button onClick={() => generate(true)} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate & Publish
          </Button>
          <Button variant="outline" onClick={() => generate(false)} disabled={busy}>
            Draft only
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Tip: leave both blank and hit Generate to let the editor pick the best story from your saved sources.
        </p>
      </div>


      {/* Sources */}
      <div className="bg-card border rounded-3xl p-5 shadow-card">
        <h2 className="font-bold font-display text-lg mb-3">AI Sources (EBSU)</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          <Input placeholder="https://example.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="flex-1 min-w-[200px]" />
          <Input placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-40" />
          <Button onClick={addSource} disabled={!newUrl.trim()}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
        {srcLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="space-y-2">
            {sources.map((s: any) => (
              <li key={s.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                <button onClick={() => toggleSource(s)} className={`w-2 h-2 rounded-full ${s.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"}`} title="Toggle active" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.label || s.url}</div>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate">
                    {s.url} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>
                <button onClick={() => removeSource(s.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
            {sources.length === 0 && <p className="text-sm text-muted-foreground">No sources yet. Add one above.</p>}
          </ul>
        )}
      </div>

      {/* Articles */}
      <div className="bg-card border rounded-3xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="font-bold font-display text-lg flex items-center gap-2"><Newspaper className="w-5 h-5" />Recent EBSU Articles</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={replaceAllCovers} disabled={replacingAllCovers || remakingAll || articles.length === 0}>
              {replacingAllCovers ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 mr-1" />}
              Replace all covers
            </Button>
            <Button size="sm" variant="outline" onClick={remakeAll} disabled={remakingAll || replacingAllCovers || articles.length === 0}>
              {remakingAll ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
              Remake all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["ebsu-news-articles"] })}>
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Remake rewrites the article body, summary, and cover image using the current news AI (fresh source scrape when sources are set, brand-watermarked cover). The slug and publish date stay the same.
        </p>
        <ul className="space-y-2">
          {articles.map((a: any) => (
            <li key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
              {a.image_url ? <img src={a.image_url} className="w-12 h-12 rounded-lg object-cover shrink-0" /> : <div className="w-12 h-12 rounded-lg bg-muted shrink-0" />}
              <div className="flex-1 min-w-0">
                <Link to="/news/$slug" params={{ slug: a.slug }} className="font-medium text-sm truncate block hover:text-primary">{a.title}</Link>
                <div className="text-xs text-muted-foreground">
                  {a.status} · {new Date(a.published_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => generateCover(a.id)}
                disabled={coveringId === a.id || remakingAll || replacingAllCovers}
                className="text-muted-foreground hover:text-primary p-1 disabled:opacity-50"
                title={a.image_url ? "Replace cover image with trained news AI" : "Generate cover image with trained news AI"}
              >
                {coveringId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              </button>
              <button
                onClick={() => remakeOne(a.id)}
                disabled={remakingId === a.id || remakingAll}
                className="text-muted-foreground hover:text-primary p-1 disabled:opacity-50"
                title="Remake with updated AI"
              >
                {remakingId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
              <button onClick={() => removeArticle(a.id)} disabled={remakingAll} className="text-muted-foreground hover:text-destructive p-1 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
          {articles.length === 0 && <p className="text-sm text-muted-foreground">No EBSU articles yet — generate one above.</p>}
        </ul>
      </div>
    </div>
  );
}
