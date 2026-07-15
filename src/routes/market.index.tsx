import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SaveButton } from "@/components/SaveButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusCircle,
  ShoppingBag,
  Search,
  Ticket,
  BookOpen,
  Package,
  Coins,
  PenLine,
} from "lucide-react";
import { EbsuBadge } from "@/components/EbsuBadge";
import { StorageMedia } from "@/components/StorageMedia";
import { BookCover } from "@/components/BookCover";
import { getLibraryBooks, getPopularNovels } from "@/lib/library-books.functions";

export const Route = createFileRoute("/market/")({ component: MarketPage });

const HUBS = [
  {
    key: "books",
    label: "Book Plug",
    tagline: "Textbooks, novels & study material",
    icon: BookOpen,
    to: "/books",
    tone: "from-emerald-500/90 via-emerald-600 to-teal-700",
    ring: "ring-emerald-300/40",
  },
  {
    key: "products",
    label: "Products",
    tagline: "Phones, fashion, hostel essentials",
    icon: Package,
    to: "/products",
    tone: "from-sky-500/90 via-indigo-600 to-blue-700",
    ring: "ring-sky-300/40",
  },
  {
    key: "tickets",
    label: "Tickets",
    tagline: "Events, parties & conferences",
    icon: Ticket,
    to: "/tickets",
    tone: "from-fuchsia-500/90 via-pink-600 to-rose-700",
    ring: "ring-fuchsia-300/40",
  },
  {
    key: "composer",
    label: "Book Composer",
    tagline: "Write, publish & sell your book",
    icon: PenLine,
    to: "/books/composer",
    tone: "from-violet-500/90 via-purple-600 to-indigo-800",
    ring: "ring-violet-300/40",
  },
] as const;

const KIND_FILTERS = ["all", "products", "tickets", "books", "composer"] as const;

function MarketPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);
  const [kind, setKind] = useState<string>("all");
  const [showSold, setShowSold] = useState(false);
  const [listingLimit, setListingLimit] = useState(30);
  const getBooksFn = useServerFn(getLibraryBooks);
  const getPopularNovelsFn = useServerFn(getPopularNovels);
  // Fresh randomized set on every mount of the market feed.
  const [feedSeed] = useState(() => Math.random().toString(36).slice(2));

  const { data: listings, isLoading, isFetching } = useQuery({
    queryKey: ["market", kind, debouncedQ, showSold, listingLimit],
    placeholderData: keepPreviousData,
    enabled: kind !== "books",
    queryFn: async () => {
      let query = supabase
        .from("market_listings")
        .select("*")
        .neq("listing_kind" as any, "advert")
        .order("created_at", { ascending: false })
        .limit(listingLimit);
      if (!showSold) query = query.eq("is_sold", false);
      if (kind !== "all") query = query.eq("listing_kind" as any, kind);
      if (debouncedQ) {
        const like = `%${debouncedQ.replace(/[%,]/g, " ")}%`;
        query = query.or(`title.ilike.${like},description.ilike.${like}`);
      }
      return (await query).data ?? [];
    },
  });
  const canLoadMoreListings = (listings?.length ?? 0) >= listingLimit;

  const { data: books, isLoading: booksLoading } = useQuery({
    queryKey: ["market-books", kind, debouncedQ, feedSeed],
    placeholderData: keepPreviousData,
    enabled: kind === "books" || kind === "all",
    queryFn: () => {
      // Feed shows 50 randomised popular novels; when the user filters/searches
      // or opens the dedicated Books tab, fall back to the full catalog query.
      if (kind === "all" && !debouncedQ) {
        return getPopularNovelsFn({ data: { limit: 50 } });
      }
      return getBooksFn({
        data: { category: "all", query: debouncedQ, limit: kind === "all" ? 50 : 120 },
      });
    },
    // Don't cache the randomised set — every visit gets a new draw.
    staleTime: 0,
    gcTime: 0,
  });

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["market-tickets", debouncedQ],
    placeholderData: keepPreviousData,
    enabled: kind === "tickets" || kind === "all",
    queryFn: async () => {
      let query = supabase
        .from("tickets")
        .select("*")
        .eq("is_sold", false)
        .order("created_at", { ascending: false })
        .limit(kind === "all" ? 6 : 60);
      if (debouncedQ) {
        const like = `%${debouncedQ.replace(/[%,]/g, " ")}%`;
        query = query.or(`title.ilike.${like},description.ilike.${like}`);
      }
      return (await query).data ?? [];
    },
  });

  const filtered = listings ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="relative overflow-hidden bg-card border rounded-3xl p-6 shadow-card">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wider">
              <ShoppingBag className="w-3.5 h-3.5" />
              Market Plug
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-bold font-display leading-tight">
              The student marketplace,{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                reimagined
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Buy, sell and trade with verified StudentsPlug members — books,
              products, tickets and original writing, all in one place.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">

            {HUBS.map(({ key, label, tagline, icon: Icon, to, tone, ring }) => (
              <Link
                key={key}
                to={to}
                className={`group relative overflow-hidden rounded-2xl p-4 min-h-[148px] text-white bg-gradient-to-br ${tone} shadow-card ring-1 ${ring} hover:shadow-glow hover:-translate-y-0.5 transition-all flex flex-col justify-between`}
              >
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-black/10 blur-2xl" />
                <div className="relative flex items-center justify-between">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/15 backdrop-blur border border-white/20">
                    <Icon className="w-5 h-5" />
                  </span>
                  <EbsuBadge size={22} />
                </div>
                <div className="relative">
                  <div className="font-bold font-display text-base leading-tight">{label}</div>
                  <p className="text-[11px] text-white/85 mt-0.5 leading-snug line-clamp-2">
                    {tagline}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-white/95 group-hover:gap-2 transition-all">
                    Open <span aria-hidden>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="relative mt-5 flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search listings…"
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showSold}
                onChange={(e) => setShowSold(e.target.checked)}
                className="accent-primary"
              />
              Show sold
            </label>
          </div>
          <div className="relative mt-3 flex gap-2 flex-wrap">
            {KIND_FILTERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setKind(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${kind === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {isLoading && <p className="text-center text-muted-foreground py-8">Loading…</p>}

        {/* TICKETS */}
        {(kind === "all" || kind === "tickets") && (tickets?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Ticket className="w-4 h-4 text-fuchsia-500" /> Tickets
                <span className="text-[10px] font-normal text-muted-foreground/70 normal-case">· events & parties</span>
              </h2>
              <Link to="/tickets" className="text-xs text-primary hover:underline shrink-0">See all →</Link>
            </div>
            {kind === "all" ? (
              <div className="-mx-2 px-2 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none">
                <div className="flex gap-3 pb-2">
                  {(tickets ?? []).map((t: any) => (
                    <Link
                      key={t.id}
                      to="/tickets/$id"
                      params={{ id: t.id }}
                      className="snap-start shrink-0 w-[240px] sm:w-[280px] bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition"
                    >
                      <div className="aspect-video bg-muted overflow-hidden relative">
                        <img src={t.photo_url} alt={t.title} className="w-full h-full object-cover" />
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-card">
                          <Ticket className="w-3 h-3" /> Ticket
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold line-clamp-1 text-sm">{t.title}</h3>
                          <span className="text-primary font-bold whitespace-nowrap text-sm">
                            {t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{t.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(tickets ?? []).map((t: any) => (
                  <Link
                    key={t.id}
                    to="/tickets/$id"
                    params={{ id: t.id }}
                    className="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition"
                  >
                    <div className="aspect-video bg-muted overflow-hidden relative">
                      <img src={t.photo_url} alt={t.title} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/95 text-white text-[10px] font-bold uppercase tracking-wider">
                        <Ticket className="w-3 h-3" /> Ticket
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold line-clamp-1 text-sm">{t.title}</h3>
                        <span className="text-primary font-bold whitespace-nowrap text-sm">
                          {t.pay_mode === "credits" ? `${t.price} cr` : `₦${Number(t.price).toLocaleString()}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
        {kind === "tickets" && !ticketsLoading && (tickets?.length ?? 0) === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Ticket className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No tickets for sale right now.</p>
            <Button asChild className="mt-4">
              <Link to="/tickets"><Ticket className="w-4 h-4 mr-1" />Open ticket marketplace</Link>
            </Button>
          </div>
        )}

        {/* BOOKS */}
        {(kind === "all" || kind === "books") && (books?.length ?? 0) > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500" /> Book Plug
                <span className="text-[10px] font-normal text-muted-foreground/70 normal-case">· novels & textbooks</span>
              </h2>
              <Link to="/books" className="text-xs text-primary hover:underline shrink-0">See all →</Link>
            </div>
            {kind === "all" ? (
              <div className="-mx-2 px-2 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-none">
                <div className="flex gap-3 pb-2">
                  {(books ?? []).map((b: any) => (
                    <Link
                      key={b.id}
                      to="/books/read/$id"
                      params={{ id: b.id }}
                      className="snap-start shrink-0 w-[130px] sm:w-[150px] bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition flex flex-col"
                    >
                      <div className="aspect-[2/3] bg-muted overflow-hidden">
                        <BookCover title={b.title} author={b.author} src={b.cover_url} className="w-full h-full" />
                      </div>
                      <div className="p-2 flex flex-col gap-0.5 flex-1">
                        <h3 className="text-xs font-semibold line-clamp-2 leading-tight">{b.title}</h3>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{b.author}</p>
                        <span className="inline-flex items-center gap-1 font-bold text-primary text-[11px] mt-auto pt-1">
                          <Coins className="w-3 h-3" /> {b.price_credits}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(books ?? []).map((b: any) => (
                  <Link
                    key={b.id}
                    to="/books/read/$id"
                    params={{ id: b.id }}
                    className="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition flex flex-col"
                  >
                    <div className="aspect-[2/3] bg-muted overflow-hidden">
                      <BookCover title={b.title} author={b.author} src={b.cover_url} className="w-full h-full" />
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <h3 className="text-sm font-semibold line-clamp-2 leading-tight">{b.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{b.author}</p>
                      <div className="flex items-center justify-between text-xs mt-auto pt-1">
                        <span className="capitalize px-2 py-0.5 rounded-full bg-muted">{b.category}</span>
                        <span className="inline-flex items-center gap-1 font-bold text-primary">
                          <Coins className="w-3 h-3" /> {b.price_credits}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
        {kind === "books" ? (
          <>
            {booksLoading && (
              <p className="text-center text-muted-foreground py-8">Loading books…</p>
            )}
            {!booksLoading && (books?.length ?? 0) === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No books yet. Open the Book Plug to fetch from freebookcentre.net.</p>
                <Button asChild className="mt-4">
                  <Link to="/books">
                    <BookOpen className="w-4 h-4 mr-1" />
                    Go to Book Plug
                  </Link>
                </Button>
              </div>
            )}
          </>
        ) : kind === "tickets" ? null : (
          <>
            {!isLoading && filtered.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No listings in this category yet. Be the first!</p>
                <Button asChild className="mt-4">
                  <Link to="/market/new" search={{ kind: "products" } as any}>
                    <PlusCircle className="w-4 h-4 mr-1" />
                    Post a listing
                  </Link>
                </Button>
              </div>
            )}
            {filtered.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-sky-500" /> Products
                    <span className="text-[10px] font-normal text-muted-foreground/70 normal-case">· from students</span>
                  </h2>
                  <Link to="/products" className="text-xs text-primary hover:underline shrink-0">See all →</Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filtered.map((l: any) => (
                    <Link
                      key={l.id}
                      to="/market/$id"
                      params={{ id: l.id }}
                      className="relative bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow transition group flex flex-col"
                    >
                      <div className="relative aspect-square bg-muted overflow-hidden">
                        {l.photos?.[0] ? (
                          <StorageMedia url={l.photos[0]} alt={l.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <Package className="w-10 h-10 opacity-30" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <EbsuBadge size={20} />
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-sky-500/95 text-white text-[10px] font-bold uppercase tracking-wider shadow-card">
                            {l.listing_kind ?? "product"}
                          </span>
                        </div>
                        <SaveButton
                          itemType="market"
                          itemId={l.id}
                          title={l.title}
                          subtitle={l.category}
                          thumbUrl={l.photos?.[0] ?? null}
                          className="absolute top-2 right-2"
                        />
                        {l.is_sold && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <span className="px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-wider">Sold</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex flex-col gap-1 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary flex-1 min-w-0">{l.title}</h3>
                          <span className="text-primary font-bold whitespace-nowrap text-sm">
                            ₦{Number(l.price).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">{l.description}</p>
                        <div className="flex gap-1.5 mt-auto pt-1 text-[10px] items-center flex-wrap">
                          <span className="px-1.5 py-0.5 rounded-full bg-muted">{l.category}</span>
                          {l.location && <span className="text-muted-foreground truncate">📍 {l.location}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {canLoadMoreListings && filtered.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setListingLimit((n) => n + 30)}
                  disabled={isFetching}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-muted hover:bg-muted/80 text-sm font-semibold disabled:opacity-50"
                >
                  {isFetching ? "Loading…" : "Load more listings"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
