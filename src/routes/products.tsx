import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { SaveButton } from "@/components/SaveButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Search,
  PlusCircle,
  RefreshCw,
  SlidersHorizontal,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { EbsuBadge } from "@/components/EbsuBadge";
import { StorageMedia } from "@/components/StorageMedia";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Products — StudentsPlug" },
      {
        name: "description",
        content:
          "Browse products from fellow students — phones, fashion, hostel essentials and more.",
      },
      { property: "og:title", content: "Products — StudentsPlug" },
      {
        property: "og:description",
        content: "Buy and sell student products on StudentsPlug.",
      },
    ],
  }),
});

const CATEGORIES = [
  "all",
  "electronics",
  "fashion",
  "hostel",
  "beauty",
  "food",
  "services",
  "other",
] as const;

const SORTS = [
  { key: "new", label: "Newest" },
  { key: "low", label: "Price ↑" },
  { key: "high", label: "Price ↓" },
] as const;

function ProductsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("new");
  const [showSold, setShowSold] = useState(false);
  const [limit, setLimit] = useState(30);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", cat, debouncedQ, sort, showSold, limit],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from("market_listings")
        .select("*")
        .eq("listing_kind" as any, "products")
        .limit(limit);
      if (!showSold) query = query.eq("is_sold", false);
      if (cat !== "all") query = query.eq("category", cat);
      if (debouncedQ) {
        const like = `%${debouncedQ.replace(/[%,]/g, " ")}%`;
        query = query.or(`title.ilike.${like},description.ilike.${like}`);
      }
      if (sort === "new") query = query.order("created_at", { ascending: false });
      if (sort === "low") query = query.order("price", { ascending: true });
      if (sort === "high") query = query.order("price", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = data ?? [];
  const canLoadMore = products.length >= limit;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden bg-card border rounded-3xl p-6 shadow-card">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-accent/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary/80">
                <Package className="w-3.5 h-3.5" /> Products
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold font-display">
                Everything students actually buy
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Phones, fashion, hostel essentials and campus services — from
                verified StudentsPlug sellers.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => qc.invalidateQueries({ queryKey: ["products"] })}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button asChild size="sm">
                <Link to="/market/new" search={{ kind: "products" } as any}>
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Sell a product
                </Link>
              </Button>
            </div>
          </div>

          {/* Search + sort */}
          <div className="relative mt-5 flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products…"
                className="pl-9"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
              <SlidersHorizontal className="w-3.5 h-3.5 ml-2 text-muted-foreground" />
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    sort === s.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
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

          {/* Categories */}
          <div className="relative mt-3 flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
                  cat === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-card border rounded-2xl p-4 shadow-card animate-pulse"
              >
                <div className="w-full h-40 rounded-xl bg-muted mb-3" />
                <div className="h-4 w-2/3 bg-muted rounded mb-2" />
                <div className="h-3 w-full bg-muted rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <div className="text-center py-20 border border-dashed rounded-3xl bg-card/50">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">
              No products match your filters yet. Be the first to list one!
            </p>
            <Button asChild className="mt-4">
              <Link to="/market/new" search={{ kind: "products" } as any}>
                <PlusCircle className="w-4 h-4 mr-1" />
                Sell a product
              </Link>
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((l: any) => (
            <Link
              key={l.id}
              to="/market/$id"
              params={{ id: l.id }}
              className="relative bg-card border rounded-2xl p-4 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition group flex flex-col"
            >
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                <EbsuBadge size={22} />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-card/95 backdrop-blur border text-[10px] font-bold uppercase tracking-wider text-primary shadow-card">
                  Product
                </span>
              </div>
              <SaveButton
                itemType="market"
                itemId={l.id}
                title={l.title}
                subtitle={l.category}
                thumbUrl={l.photos?.[0] ?? null}
                className="absolute top-2 right-2 z-10"
              />
              {l.photos?.[0] ? (
                <StorageMedia
                  url={l.photos[0]}
                  alt={l.title}
                  className="w-full h-44 object-cover rounded-xl mb-3 mt-4"
                />
              ) : (
                <div className="w-full h-44 rounded-xl mb-3 mt-4 bg-muted flex items-center justify-center">
                  <Package className="w-10 h-10 opacity-30" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold group-hover:text-primary line-clamp-2 flex-1 min-w-0">
                  {l.title}
                </h3>
                <span className="text-primary font-bold whitespace-nowrap">
                  ₦{Number(l.price).toLocaleString()}
                </span>
              </div>
              {l.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {l.description}
                </p>
              )}
              <div className="flex gap-2 mt-3 text-xs items-center flex-wrap">
                {l.category && (
                  <span className="px-2 py-0.5 rounded-full bg-muted capitalize">
                    {l.category}
                  </span>
                )}
                {l.location && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" /> {l.location}
                  </span>
                )}
                {l.is_sold && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-semibold uppercase text-[10px]">
                    Sold
                  </span>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {new Date(l.created_at).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:gap-2 transition-all">
                  View <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        {canLoadMore && (
          <div className="pt-2">
            <button
              onClick={() => setLimit((n) => n + 30)}
              disabled={isFetching}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-muted hover:bg-muted/80 text-sm font-semibold disabled:opacity-50"
            >
              {isFetching ? "Loading…" : "Load more products"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
