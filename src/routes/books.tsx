import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purchaseLibraryBook } from "@/lib/library-purchase.functions";
import { handleEmailNotVerified } from "@/components/VerifyEmailDialog";

import { getLibraryBooks, ensureLibraryCatalog } from "@/lib/library-books.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  Loader2,
  Coins,
  Check,
  PlusCircle,
  Feather,
  Download,
  ChevronDown,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { SaveButton } from "@/components/SaveButton";
import { BookCover } from "@/components/BookCover";
import { BookShape } from "@/components/market/BookShape";
import { PdfReader } from "@/components/PdfReader";

const MAX_INAPP_PDF_BYTES = 8 * 1024 * 1024; // 8MB

async function pdfSizeBytes(url: string): Promise<number | null> {
  try {
    const r = await fetch(url, { method: "HEAD", mode: "cors" });
    const len = r.headers.get("content-length");
    if (len) return Number(len);
  } catch {}
  return null;
}

export const Route = createFileRoute("/books")({ component: BooksPage });

const CATS = [
  { key: "all", label: "All" },
  { key: "novel", label: "Novel" },
  { key: "book", label: "Book" },
  { key: "textbook", label: "Textbook" },
  { key: "comics", label: "Comics" },
  { key: "poetry", label: "Poetry" },
] as const;

const TAG_GROUPS: Array<{ label: string; tags: Array<{ key: string; label: string }> }> = [
  {
    label: "Origin",
    tags: [
      { key: "all", label: "All" },
      { key: "free", label: "Free" },
      { key: "ebsu", label: "EBSU" },
      { key: "studentsplug", label: "StudentsPlug" },
      { key: "others", label: "Others" },
    ],
  },
  {
    label: "Copy",
    tags: [
      { key: "soft", label: "Soft copy" },
      { key: "hard", label: "Hard copy" },
    ],
  },
  {
    label: "Format",
    tags: [
      { key: "pdf", label: "PDF" },
      { key: "epub", label: "EPUB" },
      { key: "kindle", label: "Kindle" },
      { key: "html_zip", label: "HTML ZIP" },
      { key: "pages_zip", label: "Pages ZIP" },
      { key: "lms", label: "LMS" },
      { key: "blueprint", label: "Blueprint" },
    ],
  },
  {
    label: "Source",
    tags: [
      { key: "openstax", label: "OpenStax" },
      { key: "open_textbook_library", label: "Open Textbook" },
      { key: "gutenberg", label: "Gutenberg" },
      { key: "libretexts", label: "LibreTexts" },
      { key: "bccampus", label: "BCcampus" },
    ],
  },
];

const FORMAT_META: Record<string, { label: string; short: string; tone: string }> = {
  pdf: { label: "Download PDF", short: "PDF", tone: "bg-rose-500" },
  epub: { label: "Download EPUB", short: "EPUB", tone: "bg-indigo-500" },
  kindle: { label: "Download Kindle", short: "Kindle", tone: "bg-amber-500" },
  html_zip: { label: "Download HTML ZIP", short: "HTML", tone: "bg-emerald-500" },
  pages_zip: { label: "Download Pages ZIP", short: "Pages", tone: "bg-sky-500" },
  lms: { label: "Download LMS File", short: "LMS", tone: "bg-violet-500" },
  blueprint: { label: "Download Blueprint", short: "Blueprint", tone: "bg-slate-600" },
};

const FORMAT_ORDER = ["pdf", "epub", "kindle", "pages_zip", "html_zip", "lms", "blueprint"] as const;

const SOURCE_META: Record<string, { label: string }> = {
  openstax: { label: "OpenStax" },
  gutenberg: { label: "Project Gutenberg" },
  open_textbook_library: { label: "Open Textbook Library" },
  libretexts: { label: "LibreTexts" },
  bccampus: { label: "BCcampus" },
  freebookcentre: { label: "FreeBookCentre" },
  user: { label: "EBSU" },
};

function formatCredits(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const BOOK_SPINES = [
  "from-emerald-800 via-emerald-700 to-emerald-900",
  "from-rose-800 via-rose-700 to-rose-900",
  "from-indigo-800 via-indigo-700 to-indigo-900",
  "from-amber-800 via-amber-700 to-amber-900",
  "from-slate-800 via-slate-700 to-slate-900",
  "from-fuchsia-800 via-fuchsia-700 to-fuchsia-900",
];
const spineFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BOOK_SPINES[h % BOOK_SPINES.length];
};

const BOOK_CACHE_PREFIX = "book-plug-cache:";

function cachedBooksKey(category: string, tag: string, query: string) {
  return `${BOOK_CACHE_PREFIX}${category}:${tag}:${query.trim().toLowerCase()}`;
}

function readCachedBooks(category: string, tag: string, query: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(cachedBooksKey(category, tag, query));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { books?: any[]; savedAt?: number };
    if (!Array.isArray(parsed.books)) return undefined;
    return parsed.books;
  } catch {
    return undefined;
  }
}

function saveCachedBooks(category: string, tag: string, query: string, books: any[]) {
  if (typeof window === "undefined" || !books.length) return;
  try {
    window.localStorage.setItem(
      cachedBooksKey(category, tag, query),
      JSON.stringify({ books, savedAt: Date.now() }),
    );
  } catch {}
}

function BooksPage() {
  const [cat, setCat] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const purchaseFn = useServerFn(purchaseLibraryBook);
  const getBooksFn = useServerFn(getLibraryBooks);
  const ensureFn = useServerFn(ensureLibraryCatalog);
  // Auto-populate on entry and keep the catalog warm in the background.
  const ranAutoSync = useRef(false);
  useEffect(() => {
    if (ranAutoSync.current) return;
    ranAutoSync.current = true;
    ensureFn()
      .then((res: any) => {
        if (res?.ran > 0) qc.invalidateQueries({ queryKey: ["library-books"] });
      })
      .catch(() => {});
    const timer = window.setInterval(() => {
      ensureFn()
        .then((res: any) => {
          if (res?.ran > 0) qc.invalidateQueries({ queryKey: ["library-books"] });
        })
        .catch(() => {});
    }, 10 * 60_000);
    return () => window.clearInterval(timer);
  }, [ensureFn, qc]);

  const bookQueryKey = ["library-books", cat, tag, q] as const;

  const {
    data: books,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: bookQueryKey,
    placeholderData: keepPreviousData,
    initialData: () => readCachedBooks(cat, tag, q),
    queryFn: () =>
      getBooksFn({
        data: {
          category: cat as any,
          tag: tag as any,
          query: q,
          limit: 160,
        },
      }),
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (books?.length) saveCachedBooks(cat, tag, q, books as any[]);
  }, [books, cat, tag, q]);

  const { data: owned } = useQuery({
    queryKey: ["library-owned"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return new Set<string>();
      const { data } = await supabase
        .from("library_book_purchases")
        .select("book_id")
        .eq("user_id", u.user.id);
      return new Set((data ?? []).map((r: any) => r.book_id));
    },
  });

  const buy = useMutation({
    mutationFn: async (book_id: string) => {
      return await purchaseFn({ data: { bookId: book_id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["library-owned"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Unlocked — pick a format to download.");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Purchase failed";
      if (handleEmailNotVerified(e)) return;
      if (msg.includes("INSUFFICIENT_CREDITS"))
        toast.error("Not enough credits", {
          action: { label: "Get credits", onClick: () => window.location.assign("/get-credits") },
        });
      else if (msg.includes("Not authenticated")) toast.error("Sign in to buy books");
      else toast.error(msg);
    },

  });

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-6 sm:p-8 shadow-card">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary/80 mb-2">
                <Sparkles className="w-3.5 h-3.5" /> Book Plug · Open Library
              </div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight">
                Read anything.<br className="hidden sm:block" /> Own it forever.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground max-w-lg">
                A curated shelf from OpenStax, Open Textbook Library, Project Gutenberg, LibreTexts and BCcampus — plus books written by the EBSU community.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" asChild className="bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground hover:opacity-90 shadow">
                <Link to="/books/composer">
                  <Feather className="w-4 h-4 mr-1" /> Write a book
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/market/new" search={{ kind: "books" } as any}>
                  <PlusCircle className="w-4 h-4 mr-1" /> Sell a book
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              name="book-library-search"
              autoComplete="off"
              spellCheck={false}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, author, subject…"
              className="w-full h-11 pl-11 pr-4 rounded-full border bg-background/70 backdrop-blur focus-visible:ring-2 focus-visible:ring-primary/40 outline-none transition"
            />
          </div>

          <div className="relative mt-4 flex gap-2 flex-wrap">
            {CATS.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition shadow-sm ${
                  cat === c.key ? "bg-primary text-primary-foreground" : "bg-background/70 hover:bg-background border"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="relative mt-3 space-y-2">
            {TAG_GROUPS.map((group) => (
              <div key={group.label} className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold min-w-[52px]">
                  {group.label}
                </span>
                {group.tags.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTag(t.key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium border transition ${
                      tag === t.key
                        ? "bg-emerald-500 text-white border-emerald-500 shadow"
                        : "bg-background/70 hover:bg-background"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card overflow-hidden animate-pulse">
                <div className="aspect-[2/3] bg-muted" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (books?.length ?? 0) === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            {tag === "hard" ? (
              <>
                <p>Hard copies are listed on the Market by fellow students.</p>
                <Button asChild className="mt-4">
                  <Link to="/market" search={{ kind: "books" } as any}>
                    Browse hard copies on Market
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <p>No books here yet. Try another filter.</p>
                <Button className="mt-4" onClick={() => refetch()}>
                  Reload
                </Button>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(books ?? []).map((b: any) => (
            <BookCard
              key={b.id}
              book={b}
              owned={!!owned?.has(b.id)}
              buying={buy.isPending && buy.variables === b.id}
              onBuy={() => buy.mutate(b.id)}
            />
          ))}
        </div>

        <div className="text-center">
          <Link to="/market" className="text-xs text-muted-foreground hover:text-primary">
            ← Back to Market
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function BookCard({
  book,
  owned,
  buying,
  onBuy,
}: {
  book: any;
  owned: boolean;
  buying: boolean;
  onBuy: () => void;
}) {
  const formats: Record<string, string> = book.download_formats ?? {};
  // Fall back to a single-PDF map when a legacy row only has download_url.
  if (!Object.keys(formats).length && book.download_url) formats.pdf = book.download_url;
  const orderedKeys = FORMAT_ORDER.filter((k) => formats[k]);
  const hasFormats = orderedKeys.length > 0;
  const price = formatCredits(book.price_credits);
  const source = SOURCE_META[book.source]?.label;
  const isEbsu = book.source === "user";

  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [openingReader, setOpeningReader] = useState(false);

  const openPdfInReader = async (url: string) => {
    setOpeningReader(true);
    const t = toast.loading("Opening reader…");
    try {
      const size = await pdfSizeBytes(url);
      if (size && size > MAX_INAPP_PDF_BYTES) {
        toast.dismiss(t);
        toast.info(`File is ${(size / (1024 * 1024)).toFixed(1)}MB — downloading instead of opening in reader.`);
        await silentDownload(url, `${book.title}.pdf`.replace(/[^\w\d.\-]+/g, "_"));
      } else {
        setReaderUrl(url);
        toast.dismiss(t);
      }
    } catch {
      toast.dismiss(t);
      toast.error("Couldn't open reader — downloading instead.");
      await silentDownload(url, `${book.title}.pdf`.replace(/[^\w\d.\-]+/g, "_"));
    } finally {
      setOpeningReader(false);
    }
  };

  return (
    <div className="group relative bg-transparent flex flex-col hover:-translate-y-1 transition-all">
      <SaveButton
        itemType="book"
        itemId={book.id}
        title={book.title}
        subtitle={book.author}
        thumbUrl={book.cover_url}
        className="absolute top-2 right-2 z-20"
      />

      {/* Format badges (top-left, stacked). */}
      <div className="absolute top-2 left-3 z-20 flex flex-col gap-1 items-start max-w-[70%]">
        {orderedKeys.slice(0, 4).map((k) => (
          <span
            key={k}
            className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide text-white shadow-sm ${FORMAT_META[k].tone}`}
          >
            {FORMAT_META[k].short}
          </span>
        ))}
        {orderedKeys.length > 4 && (
          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold text-white bg-slate-700 shadow-sm">
            +{orderedKeys.length - 4}
          </span>
        )}
      </div>

      <BookShape className="aspect-[2/3] w-full" spineTone={spineFor(book.id)}>
        <BookCover
          title={book.title}
          author={book.author}
          src={book.cover_url}
          className="h-full w-full"
          imageClassName="group-hover:scale-105 transition-transform duration-500"
        />
      </BookShape>


      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="min-h-[38px]">
          <h3 className="text-sm font-semibold line-clamp-2 leading-snug">{book.title}</h3>
          {book.author && (
            <p className="text-[11px] text-muted-foreground line-clamp-1">{book.author}</p>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {source && (
            <span className="px-1.5 py-0.5 rounded-full bg-muted font-medium truncate max-w-[65%]">
              {source}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 font-bold text-primary text-xs whitespace-nowrap">
            <Coins className="w-3 h-3" /> {price}
          </span>
        </div>

        {/* Action — every book requires Unlock first, then reveals read/download. */}
        {owned ? (
          isEbsu ? (
            <Button size="sm" variant="secondary" asChild className="w-full">
              <Link to="/books/read/$id" params={{ id: book.id }}>
                <Check className="w-3.5 h-3.5 mr-1" /> Read
              </Link>
            </Button>
          ) : hasFormats ? (
            <div className="flex flex-col gap-2">
              {formats.pdf && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={openingReader}
                  onClick={() => openPdfInReader(formats.pdf)}
                  className="w-full"
                >
                  {openingReader ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <BookOpen className="w-3.5 h-3.5 mr-1" /> Read PDF
                    </>
                  )}
                </Button>
              )}
              <DownloadPicker formats={formats} keys={orderedKeys} />
            </div>
          ) : (
            <Button size="sm" variant="outline" asChild className="w-full">
              <a href={book.source_url ?? book.download_url ?? "#"} target="_blank" rel="noopener">
                <Download className="w-3.5 h-3.5 mr-1" /> Open source
              </a>
            </Button>
          )
        ) : (
          <Button size="sm" disabled={buying} onClick={onBuy} className="w-full">
            {buying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Coins className="w-3.5 h-3.5 mr-1" /> Unlock
              </>
            )}
          </Button>
        )}
      </div>
      {readerUrl && (
        <PdfReader
          url={readerUrl}
          title={book.title}
          downloadName={book.title}
          onClose={() => setReaderUrl(null)}
        />
      )}
    </div>
  );
}

// Silent background download — never opens a new tab. Fetches the file as a
// blob and clicks a hidden <a download>. Falls back to a hidden iframe when
// the fetch is blocked by CORS so the user still gets their file.
// Requires an authenticated user — anonymous visitors are redirected to /login.
async function silentDownload(url: string, suggestedName?: string) {
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user) {
    toast.error("Sign in to download books");
    setTimeout(() => { window.location.href = "/login"; }, 700);
    return;
  }
  const t = toast.loading("Downloading…");
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = suggestedName || url.split("/").pop()?.split("?")[0] || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    toast.success("Download started", { id: t });
  } catch {
    // CORS or network failure — hidden iframe still triggers the download
    // when the server sends Content-Disposition, without popping a new tab.
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => iframe.remove(), 60_000);
    toast.success("Download started", { id: t });
  }
}

function DownloadPicker({
  formats,
  keys,
}: {
  formats: Record<string, string>;
  keys: readonly string[];
}) {
  if (keys.length === 1) {
    const k = keys[0];
    return (
      <Button size="sm" className="w-full" onClick={() => silentDownload(formats[k])}>
        <Download className="w-3.5 h-3.5 mr-1" /> {FORMAT_META[k].label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="w-full">
          <Download className="w-3.5 h-3.5 mr-1" /> Download
          <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Pick a format
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {keys.map((k) => (
          <DropdownMenuItem
            key={k}
            className="flex items-center gap-2 cursor-pointer"
            onSelect={(e) => {
              e.preventDefault();
              silentDownload(formats[k]);
            }}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${FORMAT_META[k].tone}`}
              aria-hidden
            />
            <span className="text-sm">{FORMAT_META[k].label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

