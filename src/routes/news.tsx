import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Newspaper, Search, Loader2, ExternalLink, RotateCw, AlertTriangle, GraduationCap, Globe2 } from "lucide-react";
import { EbsuNewsComposer } from "@/components/EbsuNewsComposer";

export const Route = createFileRoute("/news")({
  component: NewsPage,
  head: () => ({
    meta: [
      { title: "Daily Plug News — EBSU & world headlines for students" },
      { name: "description", content: "Fresh EBSU campus news plus world, tech, science, business, health and sports headlines updated daily on StudentsPlug." },
      { property: "og:title", content: "Daily Plug News — EBSU & world headlines" },
      { property: "og:description", content: "EBSU campus news plus tech, science, business and world headlines, refreshed every day." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://ebsustudentplug.fun/news" },
    ],
    links: [{ rel: "canonical", href: "https://ebsustudentplug.fun/news" }],
  }),
});

type Article = {
  title: string;
  description: string | null;
  url: string;
  image: string | null;
  source: string | null;
  publishedAt: string | null;
};

type NewsResp = { articles?: Article[]; total?: number; error?: string };

const CATEGORIES = [
  { id: "general", label: "Top" },
  { id: "technology", label: "Tech" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business" },
  { id: "health", label: "Health" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Culture" },
] as const;

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
};

function NewsPage() {
  const [tab, setTab] = useState<"ebsu" | "other">("ebsu");
  const [category, setCategory] = useState<string>("general");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  const mode = query ? "search" : "headlines";
  const { data, isFetching, isError, refetch } = useQuery<NewsResp>({
    queryKey: ["news", mode, category, query],
    enabled: tab === "other",
    queryFn: async () => {
      const params = new URLSearchParams(
        query ? { mode: "search", q: query } : { mode: "headlines", category },
      );
      const res = await fetch(`/api/news?${params.toString()}`);
      const j = (await res.json()) as NewsResp;
      if (!res.ok) throw new Error(j.error || "Failed to load news");
      return j;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ebsuArticles = [], isFetching: ebsuFetching, refetch: refetchEbsu } = useQuery({
    queryKey: ["ebsu-news-public"],
    enabled: tab === "ebsu",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("id, title, slug, summary, image_url, published_at, source_urls")
        .eq("category", "ebsu")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const articles = data?.articles ?? [];

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Premium hero */}
        <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 mb-6 shadow-card">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-accent/30 blur-3xl" aria-hidden />
          <div className="absolute top-8 left-1/2 w-40 h-40 rounded-full bg-sky-400/20 blur-3xl" aria-hidden />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
                <Newspaper className="w-3.5 h-3.5" /> Daily Plug
              </div>
            </div>
            <Button variant="outline" size="sm" className="bg-background/70 backdrop-blur" onClick={() => (tab === "ebsu" ? refetchEbsu() : refetch())} disabled={tab === "ebsu" ? ebsuFetching : isFetching}>
              <RotateCw className={`w-4 h-4 mr-1.5 ${(tab === "ebsu" ? ebsuFetching : isFetching) ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="relative mt-4">
            <h1 className="text-3xl sm:text-5xl font-black font-display leading-[1.05] bg-gradient-to-br from-foreground via-primary to-sky-500 bg-clip-text text-transparent">
              News that moves campus.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl">
              Fresh EBSU stories side-by-side with the world's headlines — refreshed all day, every day.
            </p>
          </div>
        </section>

        {/* Category tabs: EBSU vs Other */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-muted/70 backdrop-blur rounded-2xl border">
          <button
            onClick={() => setTab("ebsu")}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === "ebsu" ? "bg-card shadow-card text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <GraduationCap className="w-4 h-4" /> EBSU News
          </button>
          <button
            onClick={() => setTab("other")}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
              tab === "other" ? "bg-card shadow-card text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe2 className="w-4 h-4" /> Other News
          </button>
        </div>


        {tab === "ebsu" ? (
          <EbsuFeed articles={ebsuArticles} loading={ebsuFetching} />
        ) : (
          <OtherNewsFeed
            data={data}
            isFetching={isFetching}
            isError={isError}
            refetch={refetch}
            category={category}
            setCategory={setCategory}
            query={query}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            submitSearch={submitSearch}
            clearSearch={clearSearch}
            articles={articles}
          />
        )}
      </div>
      {tab === "ebsu" && <EbsuNewsComposer />}
    </AppShell>
  );
}

function EbsuFeed({ articles, loading }: { articles: any[]; loading: boolean }) {
  if (loading && articles.length === 0) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border rounded-2xl overflow-hidden shadow-card animate-pulse">
            <div className="aspect-[16/9] bg-muted" />
            <div className="p-4 space-y-2"><div className="h-4 bg-muted rounded w-3/4" /><div className="h-3 bg-muted rounded w-full" /></div>
          </div>
        ))}
      </div>
    );
  }
  if (articles.length === 0) {
    return (
      <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
        <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="font-bold">No EBSU stories yet.</p>
        <p className="text-sm text-muted-foreground mt-1">Our editors are working on fresh stories — check back soon.</p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {articles.map((a) => (
        <Link
          key={a.id}
          to="/news/$slug"
          params={{ slug: a.slug }}
          className="group bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-0.5 transition flex flex-col"
        >
          {a.image_url && (
            <div className="aspect-[16/9] overflow-hidden bg-muted">
              <img src={a.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            </div>
          )}
          <div className="p-4 flex flex-col flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-1.5">EBSU · {timeAgo(a.published_at)}</div>
            <h2 className="font-bold font-display leading-snug line-clamp-3 group-hover:text-primary">{a.title}</h2>
            {a.summary && <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{a.summary}</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}

function OtherNewsFeed(props: {
  data?: NewsResp;
  isFetching: boolean;
  isError: boolean;
  refetch: () => void;
  category: string;
  setCategory: (c: string) => void;
  query: string;
  searchInput: string;
  setSearchInput: (s: string) => void;
  submitSearch: (e: FormEvent) => void;
  clearSearch: () => void;
  articles: Article[];
}) {
  const { isFetching, isError, refetch, category, setCategory, query, searchInput, setSearchInput, submitSearch, clearSearch, articles } = props;
  return (
    <>
      <form onSubmit={submitSearch} className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search any topic…" className="pl-9 pr-20" maxLength={120} />
        {query ? (
          <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold px-2.5 py-1 rounded-md hover:bg-muted text-muted-foreground">Clear</button>
        ) : (
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold px-3 py-1 rounded-md bg-primary text-primary-foreground">Search</button>
        )}
      </form>

      {!query && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 no-scrollbar">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-bold border transition ${category === c.id ? "bg-primary text-primary-foreground border-primary shadow-glow" : "bg-card hover:bg-accent"}`}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      {query && <p className="text-sm text-muted-foreground mb-4">Results for <span className="font-bold text-foreground">"{query}"</span></p>}

      {isFetching && articles.length === 0 ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-2xl overflow-hidden shadow-card animate-pulse">
              <div className="aspect-[16/9] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="font-bold">Couldn't load the news right now.</p>
          <p className="text-sm text-muted-foreground mt-1">Please try again in a moment.</p>
          <Button className="mt-4" size="sm" onClick={() => refetch()}>
            <RotateCw className="w-4 h-4 mr-1.5" /> Retry
          </Button>
        </div>
      ) : articles.length === 0 ? (
        <div className="bg-card border rounded-2xl p-8 text-center shadow-card">
          <Newspaper className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-bold">No stories found.</p>
          <p className="text-sm text-muted-foreground mt-1">Try a different topic or category.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {articles.map((a, i) => (
            <Link
              key={`${a.url}-${i}`}
              to="/news/reader"
              search={{
                url: a.url,
                title: a.title ?? "",
                source: a.source ?? "",
                image: a.image ?? "",
                publishedAt: a.publishedAt ?? "",
              }}
              className="group bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-0.5 transition flex flex-col"
            >
              {a.image ? (
                <div className="aspect-[16/9] overflow-hidden bg-muted">
                  <img
                    src={a.image}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              ) : null}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground mb-1.5">
                  {a.source && <span className="text-primary truncate max-w-[60%]">{a.source}</span>}
                  {a.publishedAt && <span>· {timeAgo(a.publishedAt)}</span>}
                </div>
                <h2 className="font-bold font-display leading-snug line-clamp-3 group-hover:text-primary">
                  {a.title}
                </h2>
                {a.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{a.description}</p>
                )}
                <span className="mt-auto pt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                  Read story <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}

        </div>
      )}
    </>
  );
}
