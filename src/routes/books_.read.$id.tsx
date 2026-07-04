import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purchaseLibraryBook } from "@/lib/library-purchase.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { BookOpen, Loader2, Download, ExternalLink, Coins, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { BookCover } from "@/components/BookCover";
import { SwipeBookReader } from "@/components/SwipeBookReader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/books_/read/$id")({ component: ReadBookPage });

function parseGutenbergId(
  book: { openlibrary_key?: string | null; read_url?: string | null } | null | undefined,
): string | null {
  if (!book) return null;
  const k = book.openlibrary_key?.match(/^gutenberg-(\d+)$/i);
  if (k) return k[1];
  const u = book.read_url?.match(/gutenberg\.org\/(?:cache\/epub|files|ebooks)\/(\d+)/i);
  return u ? u[1] : null;
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
      if (msg.includes("INSUFFICIENT_CREDITS"))
        toast.error("Not enough credits", {
          action: { label: "Get credits", onClick: () => window.location.assign("/get-credits") },
        });
      else if (msg.includes("Not authenticated")) toast.error("Sign in to unlock");
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
  // Gutenberg books render via embedded HTML reader; everything else is cached as PDF.
  const shouldCachePdf = !!book && !gid && !userBookId;
  const embedUrl = gid ? `https://www.gutenberg.org/cache/epub/${gid}/pg${gid}-images.html` : null;
  const epubUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.epub3.images` : null;
  const txtUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.txt.utf-8` : null;
  const kindleUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}.kf8.images` : null;
  const detailsUrl = gid ? `https://www.gutenberg.org/ebooks/${gid}` : (book?.read_url ?? null);
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

  // The moment a user owns a non-Gutenberg book, mirror to Cloud and open the reader.
  // 45-second client timeout so the UI never stays stuck on "Preparing…".
  useEffect(() => {
    if (!book || !owned || !shouldCachePdf || cachedPdfUrl) return;
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
                    <Button
                      size="sm"
                      onClick={downloadPdf}
                      disabled={!cachedPdfUrl || downloadLoading}
                    >
                      {cacheLoading || downloadLoading ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1" />
                      )}
                      {cacheLoading
                        ? "Preparing PDF…"
                        : downloadLoading
                          ? "Downloading…"
                          : "Download PDF"}
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
                    <Button size="sm" variant="outline" asChild>
                      <a href={kindleUrl} download>
                        <Download className="w-3.5 h-3.5 mr-1" /> Kindle
                      </a>
                    </Button>
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
                      <>
                        <p className="text-sm">
                          We couldn't extract a downloadable PDF for this book.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            preparingBookId.current = null;
                            setPrepareAttempt((attempt) => attempt + 1);
                          }}
                        >
                          Try again
                        </Button>
                        {detailsUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={detailsUrl} target="_blank" rel="noopener">
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open source page
                            </a>
                          </Button>
                        )}
                      </>
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
    </AppShell>
  );
}
// viewMode is intentionally read via the download buttons already rendered
// on the page — the chooser sets user intent and either scrolls to the
// reader or fires the PDF download.
export { };

