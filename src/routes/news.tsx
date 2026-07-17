import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Newspaper, RotateCw, GraduationCap } from "lucide-react";
import { EbsuNewsComposer } from "@/components/EbsuNewsComposer";
import feessaTvLogo from "@/assets/feessa-tv-logo.jpeg.asset.json";


export const Route = createFileRoute("/news")({
  component: NewsPage,
  head: () => ({
    meta: [
      { title: "EBSU News — Campus stories, announcements & updates" },
      { name: "description", content: "Fresh EBSU campus news, announcements and student stories — updated daily on StudentsPlug." },
      { property: "og:title", content: "EBSU News — Campus stories & updates" },
      { property: "og:description", content: "Fresh EBSU campus news, announcements and student stories, refreshed daily." },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://ebsustudentplug.fun/news" },
    ],
    links: [{ rel: "canonical", href: "https://ebsustudentplug.fun/news" }],
  }),
});

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
  const { data: ebsuArticles = [], isFetching: ebsuFetching, refetch: refetchEbsu } = useQuery({
    queryKey: ["ebsu-news-public"],
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
            <Button variant="outline" size="sm" className="bg-background/70 backdrop-blur" onClick={() => refetchEbsu()} disabled={ebsuFetching}>
              <RotateCw className={`w-4 h-4 mr-1.5 ${ebsuFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
          <div className="relative mt-4">
            <h1 className="text-3xl sm:text-5xl font-black font-display leading-[1.05] bg-gradient-to-br from-foreground via-primary to-sky-500 bg-clip-text text-transparent">
              News that moves campus.
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl">
              Fresh EBSU stories, announcements and student voices — refreshed all day, every day.
            </p>
            <a
              href="https://www.youtube.com/@feessatv"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 group"
              aria-label="FEESSA TV — Your Faculty. Your Voice. Your Legacy."
            >
              <div className="relative inline-block">
                <img
                  src={feessaTvLogo.url}
                  alt="FEESSA TV"
                  className="h-14 sm:h-16 w-auto object-contain group-hover:scale-105 transition drop-shadow-lg"
                />
                <span
                  className="absolute -top-1 -left-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-background"
                  title="Legit verified"
                >
                  <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="currentColor" aria-hidden>
                    <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3zm-1 13l6-6-1.4-1.4L11 12.2 8.4 9.6 7 11l4 4z" />
                  </svg>
                </span>
              </div>
            </a>
          </div>
        </section>

        <EbsuFeed articles={ebsuArticles} loading={ebsuFetching} />
      </div>
      <EbsuNewsComposer />
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

