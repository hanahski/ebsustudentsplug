import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purchaseLibraryBook } from "@/lib/library-purchase.functions";
import { handleEmailNotVerified } from "@/components/VerifyEmailDialog";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2, Download, ExternalLink, Coins, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import { SwipeBookReader } from "@/components/SwipeBookReader";
import { PdfReader } from "@/components/PdfReader";
import { EpubReader } from "@/components/EpubReader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/books_/read/$id")({
  component: ReadBookPage,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("library_books")
      .select("id,title,author,description,cover_url,price_credits")
      .eq("id", params.id)
      .maybeSingle();
    return { book: data };
  },
  head: ({ params, loaderData }) => {
    const url = `https://ebsustudentsplug.fun/books/read/${params.id}`;
    const b = loaderData?.book as any;
    if (!b) {
      return {
        meta: [{ title: "Book — StudentsPlug Library" }, { property: "og:url", content: url }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const desc = String(b.description ?? "").slice(0, 160) || `Read ${b.title}${b.author ? ` by ${b.author}` : ""} on StudentsPlug Library.`;
    const title = `${b.title}${b.author ? ` — ${b.author}` : ""} | StudentsPlug Library`;
    const priceNum = Number(b.price_credits ?? 0);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "book" },
        { property: "og:url", content: url },
        ...(b.cover_url ? [{ property: "og:image", content: b.cover_url }, { name: "twitter:image", content: b.cover_url }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Book",
            name: b.title,
            author: b.author ? { "@type": "Person", name: b.author } : undefined,
            description: desc,
            image: b.cover_url || undefined,
            url,
            offers: {
              "@type": "Offer",
              price: priceNum,
              priceCurrency: "NGN",
              availability: "https://schema.org/InStock",
              url,
            },
          }),
        },
      ],
    };
  },
});


function parseGutenbergId(
  book: { openlibrary_key?: string | null; read_url?: string | null } | null | undefined,
): string | null {
  if (!book) return null;
  const k = book.openlibrary_key?.match(/^gutenberg-(\d+)$/i);
  if (k) return k[1];
  const u = book.read_url?.match(/gutenberg\.org\/(?:cache\/epub|files|ebooks)\/(\d+)/i);
  return u ? u[1] : null;
}

const KINDLE_EXT = /\.(mobi|azw3?|kfx)(\?|#|$)/i;
const EPUB_EXT = /\.epub(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

function detectFormats(book: any): {
  epubUrl: string | null;
  pdfUrl: string | null;
  kindleUrl: string | null;
  kindleOnly: boolean;
} {
  const formats: Record<string, string> = book?.download_formats ?? {};
  const dl: string | null = book?.download_url ?? null;
  const epubUrl =
    formats.epub || (dl && EPUB_EXT.test(dl) ? dl : null) || null;
  const pdfUrl =
    formats.pdf || (dl && PDF_EXT.test(dl) ? dl : null) || null;
  const kindleUrl =
    formats.kindle || formats.mobi || formats.azw3 || formats.azw ||
    (dl && KINDLE_EXT.test(dl) ? dl : null) || null;
  const kindleOnly = !!kindleUrl && !epubUrl && !pdfUrl;
  return { epubUrl, pdfUrl, kindleUrl, kindleOnly };
}

function ReadBookPage() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const purchaseFn = useServerFn(purchaseLibraryBook);
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const preparingBookId = useRef<string | null>(null);
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  // "How do you want to enjoy this book?" chooser — shown once per owned book.
  const [chooserOpen, setChooserOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"read" | "download" | null>(null);
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);
  const [epubReaderOpen, setEpubReaderOpen] = useState(false);
  const chooserSeenKey = `book-chooser-seen:${id}`;

  const { data: book, isLoading } = useQuery({
    queryKey: ["library-book", id],
    queryFn: async () => {
      // Accept any source — market feed surfaces books from every provider
      // (openstax, obooko, gutenberg, freebookcentre, user…). Filtering by
      // source here was causing "Book not found" for perfectly valid rows.
      const { data, error } = await supabase
        .from("library_books")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: owned } = useQuery({
    queryKey: ["library-owned", id],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("library_book_purchases")
        .select("book_id")
        .eq("user_id", u.user.id)
        .eq("book_id", id)
        .maybeSingle();
      return !!data;
    },
  });

  const buy = useMutation({
    mutationFn: async () => {
      // Try the database RPC first — this works on ANY host (Vercel,
      // Cloudflare, Netlify) because it goes straight to Supabase. Falls
      // back to the TanStack server function if the RPC hasn't been
      // installed yet (see docs/library-purchase-rpc.sql).
      const rpc = await supabase.rpc("purchase_library_book" as any, { _book_id: id });
      if (!rpc.error) return rpc.data as any;
      const msg = String(rpc.error?.message ?? "");
      const missing = /function .*purchase_library_book.* does not exist|schema cache/i.test(msg);
      if (!missing) throw new Error(msg);
      return await purchaseFn({ data: { bookId: id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-owned"] });
      qc.invalidateQueries({ queryKey: ["library-owned", id] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Unlocked! Enjoy the read.");
      setChooserOpen(true);
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Purchase failed";
      if (handleEmailNotVerified(e)) return;
      if (msg.includes("INSUFFICIENT_CREDITS"))
        toast.error("Not enough credits", {
          action: { label: "Get credits", onClick: () => window.location.assign("/get-credits") },
        });
      else if (msg.includes("NOT_AUTHENTICATED") || msg.includes("Not authenticated")) toast.error("Sign in to unlock");
      else toast.error(msg);
    },

  });

  // First time we discover the user already owns this book, offer the chooser.
  useEffect(() => {
    if (!owned) return;
    try {
      if (window.localStorage.getItem(chooserSeenKey)) return;
    } catch { /* no-op */ }
    setChooserOpen(true);
  }, [owned, chooserSeenKey]);

  // Detect user-authored books (composer). Render their chapters inline.
  const userBookId = useMemo(() => {
    if (!book) return null;
    if (book.source !== "user") return null;
    return book.openlibrary_key?.replace(/^user:/, "") ?? null;
  }, [book]);

  const { data: userChapters } = useQuery({
    queryKey: ["user-book-chapters", userBookId],
    enabled: !!userBookId && !!owned,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_book_chapters")
        .select("id,idx,title,content")
        .eq("book_id", userBookId!)
        .order("idx");
      if (error) throw error;
      return data ?? [];
    },
  });

  const gid = useMemo(() => parseGutenbergId(book), [book]);
  const detected = useMemo(() => detectFormats(book), [book]);
  // Gutenberg → embedded reader. User books → chapters. Kindle-only → no PDF
  // caching (unreadable inline). Direct EPUB → in-app EPUB reader (no PDF cache).
  // Everything else → cache as PDF so it opens in the in-app PDF reader.
  const shouldCachePdf =
    !!book && !gid && !userBookId && !detected.kindleOnly && !detected.epubUrl;
  const embedUrl = gid ? `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}-images.html` : null;
  const epubUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.epub3.images` : detected.epubUrl;
  const txtUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.txt.utf-8` : null;
  const kindleUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.kf8.images` : detected.kindleUrl;
  const detailsUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}` : (book?.read_url ?? null);
  const canReadEpub = !!epubUrl && !gid; // Gutenberg still uses HTML embed

  const [cacheError, setCacheError] = useState<string | null>(null);

  const cachedPdfStorageKey = `book-reader-pdf:${id}`;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(cachedPdfStorageKey);
      if (!raw) return;
      const cached = JSON.parse(raw) as { url?: string; savedAt?: number };
      if (cached.url && cached.savedAt && Date.now() - cached.savedAt < 7 * 24 * 60 * 60_000) {
        setCachedPdfUrl(cached.url);
      }
    } catch {}
  }, [cachedPdfStorageKey]);

  // Direct PDF link (no caching needed) — feed it straight to the reader.
  useEffect(() => {
    if (detected.pdfUrl && !cachedPdfUrl) setCachedPdfUrl(detected.pdfUrl);
  }, [detected.pdfUrl, cachedPdfUrl]);

  // The moment a user owns a non-Gutenberg book, mirror to Cloud and open the reader.
  // 45-second client timeout so the UI never stays stuck on "Preparing…".
  useEffect(() => {
    // Skip cloud cache entirely when we already have a direct PDF URL — the
    // in-app reader can load it straight from the source (openstax, libretexts…).
    if (!book || !owned || !shouldCachePdf || cachedPdfUrl || detected.pdfUrl) return;
    if (preparingBookId.current === book.id) return;
    preparingBookId.current = book.id;
    let cancelled = false;
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 45_000);
    setCacheLoading(true);
    setCacheError(null);
    (async () => {
      try {
        const res = await fetch(`/api/public/hooks/cache-book-pdf?id=${book.id}`, {
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (cancelled) return;
        if (json?.ok && json.cached_url) {
          setCachedPdfUrl(json.cached_url);
          try {
            window.localStorage.setItem(
              cachedPdfStorageKey,
              JSON.stringify({ url: json.cached_url, savedAt: Date.now() }),
            );
          } catch {}
        } else {
          setCacheError(json?.error ?? "could_not_prepare");
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            (e as Error)?.name === "AbortError"
              ? "Took too long. The source site may be unreachable — try the source page below."
              : (e as Error).message;
          setCacheError(msg);
        }
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setCacheLoading(false);
          preparingBookId.current = null;
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      ctrl.abort();
    };
  }, [book?.id, owned, shouldCachePdf, prepareAttempt, cachedPdfUrl, cachedPdfStorageKey]);

  const downloadPdf = async () => {
    if (!cachedPdfUrl || !book) return;
    setDownloadLoading(true);
    try {
      const response = await fetch(cachedPdfUrl);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${book.title.replace(/[^a-z0-9._-]+/gi, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch {
      window.open(cachedPdfUrl, "_blank", "noopener");
      toast.error("Direct download was blocked, so the PDF was opened instead.");
    } finally {
      setDownloadLoading(false);
    }
  };

  // If the user chose "Read in app" before the cached PDF finished preparing,
  // auto-open the reader the moment the cached URL is ready.
  useEffect(() => {
    if (viewMode === "read" && cachedPdfUrl && !pdfReaderOpen) {
      setPdfReaderOpen(true);
    }
  }, [viewMode, cachedPdfUrl, pdfReaderOpen]);


  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={() => router.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Link to="/books" className="text-xs text-muted-foreground hover:text-primary">
            Book Plug
          </Link>
        </div>

        {isLoading && (
          <p className="text-center text-muted-foreground py-12">
            <Loader2 className="w-5 h-5 inline animate-spin mr-1" /> Loading book…
          </p>
        )}

        {!isLoading && !book && (
          <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Book not found.</p>
          </div>
        )}

        {book && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-card">
            <div className="p-4 flex gap-4 items-start border-b">
              <BookCover
                title={book.title}
                author={book.author}
                src={book.cover_url}
                className="w-20 h-28 rounded-lg shadow shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold font-display leading-tight">{book.title}</h1>
                <p className="text-sm text-muted-foreground">{book.author}</p>
                <div className="flex gap-2 mt-2 flex-wrap text-xs">
                  <span className="capitalize px-2 py-0.5 rounded-full bg-muted">
                    {book.category}
                  </span>
                  {book.first_publish_year && (
                    <span className="px-2 py-0.5 rounded-full bg-muted">
                      {book.first_publish_year}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-bold text-primary">
                    <Coins className="w-3 h-3" /> {book.price_credits}
                  </span>
                </div>
              </div>
            </div>

            {owned === false ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Unlock this book with <strong>{book.price_credits} credits</strong> to read or
                  download it inside the app.
                </p>
                <Button onClick={() => buy.mutate()} disabled={buy.isPending}>
                  {buy.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Coins className="w-4 h-4 mr-1" />
                  )}
                  Unlock for {book.price_credits} credits
                </Button>
              </div>
            ) : owned ? (
              <>
                <div className="px-4 py-3 flex flex-wrap gap-2 border-b bg-muted/30">
                  {shouldCachePdf && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => cachedPdfUrl && setPdfReaderOpen(true)}
                        disabled={!cachedPdfUrl || cacheLoading}
                        title="Read in the in-app PDF reader"
                      >
                        {cacheLoading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5 mr-1" />
                        )}
                        {cacheLoading ? "Preparing…" : "Read in app"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={downloadPdf}
                        disabled={!cachedPdfUrl || downloadLoading}
                      >
                        {downloadLoading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-1" />
                        )}
                        {downloadLoading ? "Downloading…" : "Download PDF"}
                      </Button>
                    </>
                  )}
                  {canReadEpub && epubUrl && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => setEpubReaderOpen(true)}
                      title="Read EPUB in the in-app reader"
                    >
                      <BookOpen className="w-3.5 h-3.5 mr-1" /> Read EPUB
                    </Button>
                  )}
                  {epubUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={epubUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Download EPUB
                      </a>
                    </Button>
                  )}
                  {txtUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={txtUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Plain Text
                      </a>
                    </Button>
                  )}
                  {kindleUrl && (
                    <div className="flex flex-col items-start gap-1">
                      <Button size="sm" variant="outline" asChild>
                        <a href={kindleUrl} download>
                          <Download className="w-3.5 h-3.5 mr-1" /> Kindle
                        </a>
                      </Button>
                      <p className="text-[10px] text-muted-foreground max-w-[220px] leading-snug">
                        Open with the free Kindle app (iOS / Android / desktop) or send to your Kindle device.
                      </p>
                    </div>
                  )}
                  {detailsUrl && gid && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={detailsUrl} target="_blank" rel="noopener">
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> All formats
                      </a>
                    </Button>
                  )}
                </div>
                {userBookId ? (
                  <div className="p-4 md:p-8 max-w-3xl lg:max-w-5xl mx-auto">
                    {(userChapters ?? []).length === 0 ? (
                      <p className="text-center text-muted-foreground text-sm">No chapters yet.</p>
                    ) : (
                      <SwipeBookReader
                        bookId={userBookId!}
                        title={book.title}
                        chapters={userChapters as any}
                      />
                    )}
                  </div>
                ) : gid && embedUrl ? (
                  <div className="w-full bg-black" style={{ height: "75vh" }}>
                    <iframe
                      src={embedUrl}
                      title={book.title}
                      className="w-full h-full border-0"
                      allow="fullscreen"
                      allowFullScreen
                    />
                  </div>
                ) : shouldCachePdf ? (
                  <div className="p-8 text-center text-muted-foreground space-y-3">
                    {cacheLoading ? (
                      <>
                        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                        <p className="text-sm">Preparing your book in the cloud…</p>
                      </>
                    ) : cacheError ? (
                      (() => {
                        // Fall back to the original source download URL rather
                        // than dead-ending the reader. Anonymous / free books
                        // always link straight to the source file.
                        const fallbackUrl =
                          (book.download_formats as any)?.pdf ||
                          (book.download_formats as any)?.epub ||
                          book.download_url ||
                          book.source_url;
                        return (
                          <div className="space-y-3">
                            <Download className="w-8 h-8 mx-auto text-primary" />
                            <p className="text-sm">
                              {fallbackUrl
                                ? "Your book is ready — download the original file from the source."
                                : "We couldn't extract a downloadable file for this book."}
                            </p>
                            {fallbackUrl && (
                              <Button asChild>
                                <a href={fallbackUrl} target="_blank" rel="noopener">
                                  <Download className="w-4 h-4 mr-1" /> Download file
                                </a>
                              </Button>
                            )}
                            <div className="flex justify-center gap-2 flex-wrap pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  preparingBookId.current = null;
                                  setPrepareAttempt((attempt) => attempt + 1);
                                }}
                              >
                                Try again
                              </Button>
                              {detailsUrl && (
                                <Button size="sm" variant="ghost" asChild>
                                  <a href={detailsUrl} target="_blank" rel="noopener">
                                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open source page
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="space-y-3">
                        <Download className="w-8 h-8 mx-auto text-primary" />
                        <p className="text-sm">Your PDF is ready to download.</p>
                        <Button onClick={downloadPdf} disabled={downloadLoading}>
                          {downloadLoading ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          {downloadLoading ? "Downloading…" : "Download PDF"}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : canReadEpub && epubUrl ? (
                  <div className="p-8 text-center space-y-3">
                    <BookOpen className="w-8 h-8 mx-auto text-primary" />
                    <p className="text-sm">This book is available in EPUB — read it right here.</p>
                    <Button onClick={() => setEpubReaderOpen(true)}>
                      <BookOpen className="w-4 h-4 mr-1" /> Read EPUB in app
                    </Button>
                  </div>
                ) : detected.kindleOnly && kindleUrl ? (
                  <div className="p-8 text-center space-y-3">
                    <Download className="w-8 h-8 mx-auto text-primary" />
                    <p className="text-sm">This book is only offered in Kindle format.</p>
                    <Button asChild>
                      <a href={kindleUrl} download>
                        <Download className="w-4 h-4 mr-1" /> Download Kindle file
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Open with the free Kindle app (iOS / Android / desktop) or send to your Kindle device.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p>No readable source available for this book.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 inline animate-spin" /> Checking access…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Enjoy chooser — "Read here" vs "Download file" */}
      <Dialog
        open={chooserOpen}
        onOpenChange={(o) => {
          setChooserOpen(o);
          if (!o) {
            try { window.localStorage.setItem(chooserSeenKey, "1"); } catch { /* no-op */ }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How would you like to enjoy this book?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setViewMode("read");
                setChooserOpen(false);
                try { window.localStorage.setItem(chooserSeenKey, "1"); } catch { /* no-op */ }
                // Prefer EPUB reader if the book is an EPUB; otherwise open the
                // in-app PDF reader (once the cached PDF is ready).
                if (canReadEpub && epubUrl) setEpubReaderOpen(true);
                else if (cachedPdfUrl) setPdfReaderOpen(true);
                else if (!cacheLoading) toast.info("Preparing your book… we'll open it in a second.");
              }}
              className="rounded-2xl border p-4 text-left hover:border-primary hover:shadow-glow transition group"
            >
              <BookOpen className="w-6 h-6 text-primary mb-2" />
              <div className="font-semibold">Read in app</div>
              <p className="text-xs text-muted-foreground mt-1">
                Open the reader right here — flip pages, resume anytime.
              </p>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("download");
                setChooserOpen(false);
                try { window.localStorage.setItem(chooserSeenKey, "1"); } catch { /* no-op */ }
                if (cachedPdfUrl) downloadPdf();
              }}
              className="rounded-2xl border p-4 text-left hover:border-primary hover:shadow-glow transition group"
            >
              <Download className="w-6 h-6 text-primary mb-2" />
              <div className="font-semibold">Download file</div>
              <p className="text-xs text-muted-foreground mt-1">
                Save the PDF{gid ? " / EPUB / Kindle" : ""} to your device.
              </p>
            </button>
          </div>
          <p className="text-[11px] text-center text-muted-foreground pt-2">
            You can switch anytime from the buttons above the reader.
          </p>
        </DialogContent>
      </Dialog>

      {pdfReaderOpen && cachedPdfUrl && book && (
        <PdfReader
          url={cachedPdfUrl}
          title={book.title}
          downloadName={book.title}
          onClose={() => setPdfReaderOpen(false)}
        />
      )}

      {epubReaderOpen && epubUrl && book && (
        <EpubReader
          url={epubUrl}
          title={book.title}
          bookId={book.id}
          onClose={() => setEpubReaderOpen(false)}
        />
      )}
    </AppShell>
  );
}

