import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Newspaper, RotateCw, GraduationCap, BadgeCheck, ExternalLink } from "lucide-react";
import { EbsuNewsComposer } from "@/components/EbsuNewsComposer";
import { ShimmerImage } from "@/components/ShimmerImage";
const feessaTvLogo = { url: "/feessa-tv-logo.jpeg" };
const FEESSA_HANDLE = "FEESSA TV";


export const Route = createFileRoute("/news")({
  component: NewsPage,
  head: () => ({
    meta: [
      { title: "EBSU News — Campus stories, announcements & updates" },
      { name: "description", content: "Fresh EBSU campus news, announcements and student stories — updated daily on StudentsPlug." },
      { property: "og:title", content: "EBSU News — Campus stories & updates" },
      { property: "og:description", content: "Fresh EBSU campus news, announcements and student stories, refreshed daily." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ebsustudentsplug.fun/news" },
    ],
    links: [{ rel: "canonical", href: "https://ebsustudentsplug.fun/news" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "EBSU News",
          url: "https://ebsustudentsplug.fun/news",
          about: "Ebonyi State University campus news, announcements and student updates",
          isPartOf: { "@type": "WebSite", name: "StudentsPlug", url: "https://ebsustudentsplug.fun/" },
        }),
      },
    ],
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

  // Look up the FEESSA TV account by display name so we can link the logo
  // to their in-app profile.
  const { data: feessa } = useQuery({
    queryKey: ["feessa-tv-profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_key, is_legit, is_verified, bio")
        .ilike("display_name", FEESSA_HANDLE)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60_000,
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

            <FeessaCard profile={feessa} />
          </div>
        </section>

        <EbsuFeed articles={ebsuArticles} loading={ebsuFetching} />
      </div>
      <EbsuNewsComposer />
    </AppShell>
  );
}

/** Verified source card for FEESSA TV. Links to their in-app profile
 *  (looked up by display name). Falls back to a static badge when the
 *  profile hasn't been created yet. */
function FeessaCard({ profile }: { profile: any | null | undefined }) {
  const to = profile?.id ? (`/profile/${profile.id}` as const) : null;
  const Content = (
    <div className="group relative mt-5 inline-flex items-center gap-3 pl-3 pr-4 py-2 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] via-background/60 to-sky-500/[0.06] backdrop-blur shadow-[0_8px_30px_-12px_rgba(16,185,129,0.35)] hover:shadow-[0_10px_40px_-8px_rgba(16,185,129,0.5)] hover:border-emerald-400/50 transition-all">
      <div className="relative shrink-0">
        <div className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-md opacity-70 group-hover:opacity-100 transition" aria-hidden />
        <img
          src={feessaTvLogo.url}
          alt="FEESSA TV"
          className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full object-cover ring-2 ring-emerald-400/60 shadow-lg"
        />
        <span
          className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white ring-2 ring-background shadow"
          title="Verified news source"
        >
          <BadgeCheck className="w-3 h-3" strokeWidth={3} />
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold font-display text-sm sm:text-base leading-tight">FEESSA TV</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Verified</span>
        </div>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
          Your Faculty. Your Voice. Your Legacy.
        </p>
        {to && (
          <p className="text-[10px] text-primary/80 mt-0.5 inline-flex items-center gap-0.5 group-hover:underline">
            Visit profile <ExternalLink className="w-2.5 h-2.5" />
          </p>
        )}
      </div>
    </div>
  );
  if (to) return <Link to={to} className="block w-fit">{Content}</Link>;
  return Content;
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
            <ShimmerImage
              src={a.image_url}
              alt=""
              aspect="16 / 9"
              wrapperClassName="bg-muted"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
            />
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

