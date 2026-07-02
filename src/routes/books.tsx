import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { purchaseLibraryBook } from "@/lib/library-purchase.functions";
import { getLibraryBooks } from "@/lib/library-books.functions";
import { runLibrarySync } from "@/lib/library-sync.functions";
import { useAuth } from "@/lib/auth";
import { getIsAdminUser } from "@/lib/admin-role";
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
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { SaveButton } from "@/components/SaveButton";
import { BookCover } from "@/components/BookCover";

export const Route = createFileRoute("/books")({ component: BooksPage });

const CATS = [
  { key: "all", label: "All" },
  { key: "novel", label: "Novel" },
  { key: "book", label: "Book" },
  { key: "comics", label: "Comics" },
  { key: "poetry", label: "Poetry" },
] as const;

const TAGS = [
  { key: "all", label: "All sources" },
  { key: "pdf", label: "PDF" },
  { key: "epub", label: "EPUB" },
  { key: "free", label: "Free" },
  { key: "ebsu", label: "EBSU" },
  { key: "openstax", label: "OpenStax" },
  { key: "open_textbook_library", label: "Open Textbook" },
  { key: "gutenberg", label: "Gutenberg" },
  { key: "libretexts", label: "LibreTexts" },
  { key: "bccampus", label: "BCcampus" },
] as const;

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

function BooksPage() {
  const [cat, setCat] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const purchaseFn = useServerFn(purchaseLibraryBook);
  const getBooksFn = useServerFn(getLibraryBooks);
  const syncFn = useServerFn(runLibrarySync);
  const { user } = useAuth();
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => getIsAdminUser(user!.id),
  });
  const sync = useMutation({
    mutationFn: async () => syncFn({ data: { source: "all" } }),
    onSuccess: (res) => {
      toast.success(`Catalog synced (${res.results?.length ?? 0} sources)`);
      qc.invalidateQueries({ queryKey: ["library-books"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Sync failed"),
  });

  const {
    data: books,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["library-books", cat, tag, q],
    placeholderData: keepPreviousData,
    queryFn: () =>
      getBooksFn({
        data: {
          category: cat as any,
          tag: tag as any,
          query: q,
          limit: 160,
        },
      }),
    staleTime: 60_000,
  });

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
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => sync.mutate()}
                  disabled={sync.isPending}
                  title="Sync library sources"
                >
                  {sync.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1" />
                  )}
                  Sync sources
                </Button>
              )}
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
          <div className="relative mt-2 flex gap-2 flex-wrap">
            {TAGS.map((t) => (
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
            <p>No books here yet. Try another filter.</p>
            <Button className="mt-4" onClick={() => refetch()}>
              Reload
            </Button>
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

  return (
    <div className="group relative bg-card border rounded-2xl overflow-hidden shadow-card flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <SaveButton
        itemType="book"
        itemId={book.id}
        title={book.title}
        subtitle={book.author}
        thumbUrl={book.cover_url}
        className="absolute top-2 right-2 z-10"
      />

      {/* Format badges (top-left, stacked). */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start max-w-[70%]">
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

      <div className="aspect-[2/3] bg-muted overflow-hidden">
        <BookCover
          title={book.title}
          author={book.author}
          src={book.cover_url}
          className="h-full w-full"
          imageClassName="group-hover:scale-105 transition-transform duration-500"
        />
      </div>

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

        {/* Action */}
        {isEbsu ? (
          // Community-written EBSU book → read online is fine (composer flow).
          owned ? (
            <Button size="sm" variant="secondary" asChild className="w-full">
              <Link to="/books/read/$id" params={{ id: book.id }}>
                <Check className="w-3.5 h-3.5 mr-1" /> Read
              </Link>
            </Button>
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
          )
        ) : hasFormats ? (
          <DownloadPicker formats={formats} keys={orderedKeys} />
        ) : (
          <Button size="sm" variant="outline" asChild className="w-full">
            <a href={book.source_url ?? book.download_url ?? "#"} target="_blank" rel="noopener">
              <Download className="w-3.5 h-3.5 mr-1" /> Open source
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function DownloadPicker({
  formats,
  keys,
}: {
  formats: Record<string, string>;
  keys: readonly string[];
}) {
  // Single format → one-click download button (no menu needed).
  if (keys.length === 1) {
    const k = keys[0];
    return (
      <Button size="sm" asChild className="w-full">
        <a href={formats[k]} target="_blank" rel="noopener" download>
          <Download className="w-3.5 h-3.5 mr-1" /> {FORMAT_META[k].label}
        </a>
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
          <DropdownMenuItem key={k} asChild>
            <a
              href={formats[k]}
              target="_blank"
              rel="noopener"
              download
              className="flex items-center gap-2 cursor-pointer"
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${FORMAT_META[k].tone}`}
                aria-hidden
              />
              <span className="text-sm">{FORMAT_META[k].label}</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
