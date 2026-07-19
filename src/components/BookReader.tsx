import { lazy, Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, AlertCircle } from "lucide-react";

// react-book-reader is browser-only (foliate-js touches window/DOM at import
// time). Load it lazily so it never lands in the SSR bundle.
const ReactReader = lazy(async () => {
  const mod = await import("react-book-reader");
  return { default: mod.ReactReader };
});

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

async function fetchWithTimeout(url: string, creds: RequestCredentials, timeoutMs = 35_000) {
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { credentials: creds, redirect: "follow", signal: controller.signal });
  } finally {
    window.clearTimeout(t);
  }
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

        const blob = await res.blob();
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
    return () => { cancelled = true; };
  }, [url, title, formatHint]);

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
      <div className="flex-1 relative bg-white dark:bg-zinc-900">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm font-semibold">Couldn't open this book</p>
            <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        ) : !file ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading book…
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading reader…
              </div>
            }
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
          </Suspense>
        )}
      </div>
    </div>
  );
}
