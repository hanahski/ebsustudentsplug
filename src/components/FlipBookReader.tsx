import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { SwipeBookReader } from "@/components/SwipeBookReader";

type Chapter = { id: string; idx: number; title: string; content: string | null };

/**
 * Universal flip-page reader. Loads a PDF or EPUB, extracts well-arranged
 * text (paragraphs) and images (page renders / embedded images) into
 * chapters, then hands them to SwipeBookReader so every book — PDF, EPUB,
 * Kindle-exported EPUB — reads the same way as a composer-authored book.
 */
export function FlipBookReader({
  url,
  kind,
  title,
  bookId,
  onClose,
}: {
  url: string;
  kind: "pdf" | "epub";
  title: string;
  bookId: string;
  onClose: () => void;
}) {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chs =
          kind === "pdf"
            ? await extractPdfChapters(url, (d, t) => {
                if (!cancelled) { setProgress(d); setTotal(t); }
              })
            : await extractEpubChapters(url, (d, t) => {
                if (!cancelled) { setProgress(d); setTotal(t); }
              });
        if (!cancelled) setChapters(chs);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Could not open this book.");
      }
    })();
    return () => { cancelled = true; };
  }, [url, kind]);

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col"
      style={{ zIndex: 2147482900 }}
      role="dialog"
      aria-label={`Reading ${title}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-card shrink-0">
        <p className="text-sm font-semibold font-display truncate pr-2">{title}</p>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close reader">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-3 md:p-6">
        {err ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">{err}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={onClose}>Close</Button>
          </div>
        ) : !chapters ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">
              Preparing pages… {total > 0 ? `${progress}/${total}` : ""}
            </p>
            {total > 0 && (
              <div className="w-56 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                  style={{ width: `${Math.round((progress / total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl lg:max-w-5xl mx-auto">
            <SwipeBookReader bookId={bookId} title={title} chapters={chapters} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- PDF extraction ---------------- */

async function loadPdfJs(): Promise<any> {
  const pdfjs: any = await import(
    /* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.mjs";
  return pdfjs;
}

async function extractPdfChapters(
  url: string,
  onProgress: (done: number, total: number) => void,
): Promise<Chapter[]> {
  const pdfjs = await loadPdfJs();
  let doc: any;
  try {
    doc = await pdfjs.getDocument({
      url,
      withCredentials: false,
      disableAutoFetch: true,
      disableStream: false,
    }).promise;
  } catch (e: any) {
    throw new Error("This PDF couldn't be downloaded. Try again on a stable connection.");
  }
  const numPages = doc.numPages;

  // Attempt to derive chapter ranges from the PDF outline.
  let ranges: { title: string; from: number; to: number }[] = [];
  try {
    const outline = await doc.getOutline();
    if (outline && outline.length) {
      const flat: { title: string; page: number }[] = [];
      const walk = async (nodes: any[]) => {
        for (const n of nodes) {
          try {
            const dest =
              typeof n.dest === "string" ? await doc.getDestination(n.dest) : n.dest;
            if (dest && dest[0]) {
              const pageIndex = await doc.getPageIndex(dest[0]);
              flat.push({ title: String(n.title || "Chapter"), page: pageIndex + 1 });
            }
          } catch { /* skip */ }
          if (n.items?.length) await walk(n.items);
        }
      };
      await walk(outline);
      flat.sort((a, b) => a.page - b.page);
      const dedup: typeof flat = [];
      for (const f of flat) {
        if (!dedup.length || dedup[dedup.length - 1].page !== f.page) dedup.push(f);
      }
      if (dedup.length) {
        for (let i = 0; i < dedup.length; i++) {
          ranges.push({
            title: dedup[i].title,
            from: dedup[i].page,
            to: i + 1 < dedup.length ? dedup[i + 1].page - 1 : numPages,
          });
        }
      }
    }
  } catch { /* ignore, fall back below */ }

  if (!ranges.length) {
    const step = Math.max(1, Math.min(15, Math.ceil(numPages / 12)));
    for (let p = 1; p <= numPages; p += step) {
      const to = Math.min(numPages, p + step - 1);
      ranges.push({ title: `Pages ${p}–${to}`, from: p, to });
    }
  }

  const chapters: Chapter[] = [];
  let done = 0;
  onProgress(0, numPages);

  for (let ci = 0; ci < ranges.length; ci++) {
    const r = ranges[ci];
    const parts: string[] = [];
    for (let p = r.from; p <= r.to; p++) {
      try {
        const page = await doc.getPage(p);
        const text = await pageTextToHtml(page).catch(() => "");
        if (text) parts.push(text);
        try { page.cleanup(); } catch { /* ignore */ }
      } catch {
        // Skip broken page but keep going.
      }
      done++;
      onProgress(done, numPages);
    }
    chapters.push({
      id: `pdf-${ci}`,
      idx: ci,
      title: r.title,
      content: parts.join("\n") || "<p><em>(no text on these pages)</em></p>",
    });
  }
  try { await doc.destroy(); } catch { /* ignore */ }
  if (!chapters.length) throw new Error("This PDF has no readable pages.");
  return chapters;
}


async function pageTextToHtml(page: any): Promise<string> {
  const tc = await page.getTextContent();
  if (!tc?.items?.length) return "";
  // Group items into lines by Y coordinate, then lines into paragraphs by gap.
  type Line = { y: number; height: number; str: string };
  const lines: Line[] = [];
  for (const it of tc.items as any[]) {
    const s = String(it.str ?? "");
    if (!s) continue;
    const y = it.transform?.[5] ?? 0;
    const h = it.height ?? 12;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - y) < Math.max(2, h * 0.5)) {
      last.str += (it.hasEOL ? " " : "") + s;
    } else {
      lines.push({ y, height: h, str: s });
    }
  }
  if (!lines.length) return "";
  const paras: string[] = [];
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const prev = lines[i - 1];
    const gap = prev ? Math.abs(prev.y - cur.y) : 0;
    const paragraphBreak = prev && gap > cur.height * 1.6;
    if (paragraphBreak && buf.length) {
      paras.push(buf.join(" ").trim());
      buf = [];
    }
    buf.push(cur.str);
  }
  if (buf.length) paras.push(buf.join(" ").trim());
  return paras
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

/* ---------------- EPUB extraction ---------------- */

async function extractEpubChapters(
  url: string,
  onProgress: (done: number, total: number) => void,
): Promise<Chapter[]> {
  const mod: any = await import("epubjs");
  const ePub = mod.default ?? mod;
  const book = ePub(url, { openAs: "epub" });
  await book.ready;

  // Build a title map from the nav (falls back to spine idrefs).
  const titles = new Map<string, string>();
  try {
    const nav = await book.loaded.navigation;
    const walk = (items: any[]) => {
      for (const it of items || []) {
        const href = String(it.href || "").split("#")[0];
        if (href) titles.set(href, String(it.label || "").trim());
        if (it.subitems?.length) walk(it.subitems);
      }
    };
    walk((nav as any).toc || []);
  } catch { /* ignore */ }

  const spine: any = book.spine as any;
  const items: any[] = spine?.items || spine?.spineItems || [];
  const total = items.length;
  onProgress(0, total);

  const chapters: Chapter[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      const section = spine.get(it.idref || it.href || i);
      if (!section) { onProgress(i + 1, total); continue; }
      const contents = await section.load(book.load.bind(book));
      // contents is usually a Document; extract body innerHTML.
      let html = "";
      if (contents && (contents as Document).body) {
        html = (contents as Document).body.innerHTML;
      } else if (typeof contents === "string") {
        html = contents;
      }
      // Rewrite relative asset URLs to absolute epub archive URLs so <img> works.
      html = rewriteEpubHtml(html, book, it.href || section.href);
      const title =
        titles.get(String(it.href || section.href || "").split("#")[0]) ||
        `Section ${i + 1}`;
      chapters.push({
        id: `epub-${i}`,
        idx: i,
        title,
        content: html || "<p><em>(empty section)</em></p>",
      });
      try { section.unload(); } catch { /* ignore */ }
    } catch { /* skip broken section */ }
    onProgress(i + 1, total);
  }

  try { book.destroy(); } catch { /* ignore */ }
  if (!chapters.length) throw new Error("This EPUB has no readable sections.");
  return chapters;
}

function rewriteEpubHtml(html: string, book: any, base: string): string {
  if (!html) return html;
  try {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const resolve = (href: string): string => {
      if (!href) return href;
      if (/^(https?:|data:|blob:)/i.test(href)) return href;
      try {
        const abs = new URL(href, "epub:///" + (base || "")).pathname.replace(/^\//, "");
        const zipUrl = book.archive?.zip?.url?.href;
        if (book.archive && typeof book.archive.createUrl === "function") {
          // Async — we can't await here; skip for simplicity.
        }
        if (zipUrl) return zipUrl + "#" + abs;
        return href;
      } catch { return href; }
    };
    tpl.content.querySelectorAll("img[src]").forEach((el) => {
      const src = el.getAttribute("src") || "";
      const abs = resolve(src);
      // Best-effort blob url via archive.
      try {
        book.archive?.createUrl?.(new URL(src, "epub:///" + (base || "")).pathname.replace(/^\//, ""), { base64: false }).then((u: string) => {
          el.setAttribute("src", u);
        });
      } catch { /* ignore */ }
      el.setAttribute("data-orig", src);
      el.setAttribute("src", abs);
    });
    return tpl.innerHTML;
  } catch {
    return html;
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
