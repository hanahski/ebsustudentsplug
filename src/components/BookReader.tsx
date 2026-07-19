import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, AlertCircle, BookOpen, Sun, Moon, Coffee, Type, Minus, Plus } from "lucide-react";


// react-book-reader is browser-only (foliate-js touches window/DOM at import
// time). Load it lazily so it never lands in the SSR bundle. We also kick
// off the import as soon as this module is evaluated so the ~1MB reader
// bundle is warm by the time the user's book bytes finish downloading —
// otherwise the reader would appear "stuck" while the chunk is fetched.
const readerImport = () => import("react-book-reader");
const ReactReader = lazy(async () => {
  const mod = await readerImport();
  return { default: mod.ReactReader };
});
if (typeof window !== "undefined") {
  // Fire and forget — cached by the browser for the real render.
  readerImport().catch(() => {});
}

export type BookReaderFormat = "pdf" | "epub" | "mobi" | "azw" | "azw3" | "fb2" | "cbz";

const READABLE_FORMATS = ["pdf", "epub", "mobi", "azw", "azw3", "fb2", "cbz"] as const;

export function normalizeBookReaderFormat(format: string | null | undefined): BookReaderFormat | null {
  const f = String(format ?? "").toLowerCase();
  if (f === "kindle" || f === "kf8" || f === "kfx") return "mobi";
  return (READABLE_FORMATS as readonly string[]).includes(f) ? (f as BookReaderFormat) : null;
}

function extractOriginalUrl(input: string): string {
  try {
    const u = new URL(input, window.location.href);
    const proxied = u.pathname === "/api/public/proxy-pdf" ? u.searchParams.get("url") : null;
    return proxied ? new URL(proxied, window.location.href).toString() : u.toString();
  } catch {
    return input;
  }
}

function extensionFromUrl(input: string): BookReaderFormat | null {
  try {
    const pathname = new URL(input, window.location.href).pathname.toLowerCase();
    const match = /\.(epub|pdf|mobi|azw3?|fb2|cbz)(?:$|[._-])/i.exec(pathname);
    return normalizeBookReaderFormat(match?.[1]);
  } catch {
    return normalizeBookReaderFormat(/\.(epub|pdf|mobi|azw3?|fb2|cbz)(\?|#|$)/i.exec(input)?.[1]);
  }
}

function looksLikeHtml(bytes: Uint8Array, type: string) {
  const head = new TextDecoder().decode(bytes.slice(0, 96)).trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.includes("<fictionbook")) return false;
  if (head.startsWith("<!doctype") || head.startsWith("<html") || head.includes("<body")) return true;
  return (type.includes("html") || type.includes("text/plain")) && head.startsWith("<");
}

function detectFileFormat(bytes: Uint8Array, type: string, sourceUrl: string, hint?: BookReaderFormat | null): BookReaderFormat | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("epub")) return "epub";
  if (type.includes("mobipocket") || type.includes("kindle")) return "mobi";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return hint ?? extensionFromUrl(sourceUrl) ?? "epub";
  }
  const text = new TextDecoder().decode(bytes.slice(0, 128));
  if (text.includes("BOOKMOBI") || text.includes("TEXtREAd")) return hint ?? "mobi";
  if (text.trimStart().startsWith("<?xml") || text.includes("<FictionBook")) return "fb2";
  return hint ?? extensionFromUrl(sourceUrl);
}

async function fetchWithTimeout(url: string, creds: RequestCredentials, timeoutMs = 45_000) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { credentials: creds, redirect: "follow", signal: controller.signal });
  } finally {
    window.clearTimeout(t);
  }
}

async function readBodyWithProgress(
  res: Response,
  onProgress: (loaded: number, total: number) => void,
): Promise<Blob> {
  const total = Number(res.headers.get("content-length") ?? 0);
  if (!res.body || !("getReader" in res.body)) return res.blob();
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  // Throttle progress updates so we don't thrash React on every network chunk.
  let lastPost = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      const now = Date.now();
      if (now - lastPost > 120) {
        lastPost = now;
        onProgress(loaded, total);
      }
    }
  }
  onProgress(loaded, total);
  const type = res.headers.get("content-type") || "application/octet-stream";
  return new Blob(chunks as BlobPart[], { type });
}

/**
 * Universal fullscreen book reader. Wraps react-book-reader (foliate-js) so
 * every format — EPUB, MOBI, KF8/AZW3, FB2, CBZ, PDF — opens in the same
 * high-quality reader with TOC, pagination, keyboard/touch navigation, and
 * per-book resume via localStorage.
 *
 * We pre-fetch the file ourselves and hand foliate a Blob/File. This dodges
 * "Failed to fetch" errors inside foliate's own loader when the source URL
 * is cross-origin, uses a signed token that later expires, or the request
 * is intercepted by third-party scripts.
 */
export function BookReader({
  url,
  title,
  bookId,
  formatHint,
  onClose,
}: {
  url: string;
  title: string;
  bookId: string;
  formatHint?: BookReaderFormat | null;
  onClose: () => void;
}) {
  const locKey = `book-loc:${bookId}`;
  const [location, setLocation] = useState<string | number | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(locKey);
      if (saved) setLocation(saved);
    } catch { /* ignore */ }
  }, [locKey]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setFile(null);
    setProgress({ loaded: 0, total: 0 });
    (async () => {
      // Try multiple fetch strategies in order — a same-origin proxy on our
      // Worker, then public CORS proxies as a fallback so books still open
      // even if our proxy route hasn't been redeployed yet or is auth-gated
      // on a private preview.
      const abs = extractOriginalUrl(url);
      const sameOrigin = (() => {
        try { return new URL(abs).origin === window.location.origin; }
        catch { return false; }
      })();
      const candidates: Array<{ label: string; url: string; creds: RequestCredentials }> = [];
      if (sameOrigin) {
        candidates.push({ label: "direct", url: abs, creds: "include" });
      } else {
        candidates.push({ label: "same-origin proxy", url: `/api/public/proxy-pdf?url=${encodeURIComponent(abs)}`, creds: "include" });
        candidates.push({ label: "corsproxy.io", url: `https://corsproxy.io/?url=${encodeURIComponent(abs)}`, creds: "omit" });
        candidates.push({ label: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(abs)}`, creds: "omit" });
        candidates.push({ label: "direct", url: abs, creds: "omit" });
      }
      let res: Response | null = null;
      let lastErr: unknown = null;
      for (const c of candidates) {
        if (cancelled) return;
        try {
          const r = await fetchWithTimeout(c.url, c.creds);
          if (r.ok) { res = r; break; }
          lastErr = new Error(`${c.label} → HTTP ${r.status}`);
        } catch (e) {
          lastErr = e;
        }
      }
      try {
        if (!res) throw (lastErr instanceof Error ? lastErr : new Error("Download failed"));

        const blob = await readBodyWithProgress(res, (loaded, total) => {
          if (!cancelled) setProgress({ loaded, total });
        });
        if (cancelled) return;
        const header = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
        const contentType = (blob.type || res.headers.get("content-type") || "").toLowerCase();
        if (looksLikeHtml(header, contentType)) {
          throw new Error("This source is a web page, not a readable book file. Pick a PDF, EPUB, MOBI/AZW3, FB2, or CBZ format.");
        }
        const guessedExt = detectFileFormat(header, contentType, abs, formatHint);
        if (!guessedExt) {
          throw new Error("Unsupported book file. Use PDF, EPUB, MOBI/AZW3, FB2, or CBZ.");
        }
        const name = `${(title || "book").replace(/[^\w.-]+/g, "_")}.${guessedExt}`;
        setFile(new File([blob], name, { type: blob.type || "application/octet-stream" }));
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || "Could not load this book");
      }
    })();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [url, title, formatHint]);

  const themeKey = "book-reader-theme";
  const sizeKey = "book-reader-size";
  const [theme, setTheme] = useState<"light" | "sepia" | "dark">("sepia");
  const [fontScale, setFontScale] = useState<number>(100);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem(themeKey) as "light" | "sepia" | "dark" | null;
      const s = Number(window.localStorage.getItem(sizeKey));
      if (t) setTheme(t);
      if (s && s >= 80 && s <= 160) setFontScale(s);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(themeKey, theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => {
    try { window.localStorage.setItem(sizeKey, String(fontScale)); } catch { /* ignore */ }
  }, [fontScale]);

  const surface =
    theme === "light" ? "bg-white text-zinc-900"
    : theme === "sepia" ? "bg-[#f5ecd7] text-[#3b2f1e]"
    : "bg-[#0f1115] text-zinc-100";

  return (
    <div
      className="fixed inset-0 flex flex-col bg-background"
      style={{ zIndex: 2147482900 }}
      role="dialog"
      aria-label={`Reading ${title}`}
    >
      {/* Header */}
      <div className="relative shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/10 via-background to-primary/5 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner ring-1 ring-primary/20">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Now reading</p>
            <p className="truncate text-sm font-semibold font-display leading-tight">{title}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close reader" className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 shadow-sm">
            {([
              { k: "light", icon: Sun, label: "Light" },
              { k: "sepia", icon: Coffee, label: "Sepia" },
              { k: "dark", icon: Moon, label: "Dark" },
            ] as const).map(({ k, icon: Icon, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setTheme(k)}
                aria-label={label}
                aria-pressed={theme === k}
                className={`flex h-7 w-7 items-center justify-center rounded-full transition-all ${
                  theme === k
                    ? "bg-primary text-primary-foreground shadow-sm scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.max(80, s - 10))}
              aria-label="Smaller text"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-1 px-2 text-[11px] font-semibold tabular-nums text-foreground/80">
              <Type className="h-3 w-3" /> {fontScale}%
            </div>
            <button
              type="button"
              onClick={() => setFontScale((s) => Math.min(160, s + 10))}
              aria-label="Larger text"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Reader surface */}
      <div className={`flex-1 relative transition-colors duration-300 ${surface}`}>
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold font-display">Couldn't open this book</p>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={onClose} className="rounded-full">Close reader</Button>
          </div>
        ) : !file ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing your book…
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading reader…
              </div>
            }
          >
            <div
              className="absolute inset-0"
              style={{ fontSize: `${fontScale}%` }}
            >
              <ReactReader
                url={file as unknown as string}
                title={title}
                location={location as never}
                locationChanged={(loc: string) => {
                  setLocation(loc);
                  try { window.localStorage.setItem(locKey, loc); } catch { /* ignore */ }
                }}
              />
            </div>
          </Suspense>
        )}
      </div>
    </div>
  );
}

