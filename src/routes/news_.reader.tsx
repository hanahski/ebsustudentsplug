import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Calendar,
  Globe2,
  Share2,
  BookOpen,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import { useMemo } from "react";
import { toast } from "sonner";

const searchSchema = z.object({
  url: z.string().url(),
  title: z.string().optional().default(""),
  source: z.string().optional().default(""),
  image: z.string().optional().default(""),
  publishedAt: z.string().optional().default(""),
});

export const Route = createFileRoute("/news_/reader")({
  validateSearch: (search) => searchSchema.parse(search),
  component: NewsReaderPage,
  head: ({ match }: any) => {
    const s = match?.search ?? {};
    const title = s.title || "Reader — StudentsPlug News";
    return {
      meta: [
        { title: `${title} — StudentsPlug`.slice(0, 70) },
        { name: "description", content: `Read the full story from ${s.source || "the web"} inside StudentsPlug.`.slice(0, 160) },
        { property: "og:title", content: title },
        ...(s.image ? [{ property: "og:image", content: s.image }] : []),
      ],
    };
  },
});

// Clean the markdown from r.jina.ai: strip nav junk, image-only lines that are logos, etc.
function cleanMarkdown(md: string, heroImage?: string): string {
  if (!md) return md;
  let s = md;
  // Drop leading title heading if it matches the hero title area (jina sometimes duplicates)
  // Remove images equal to the hero to prevent duplicate hero.
  if (heroImage) {
    const esc = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`!\\[[^\\]]*\\]\\(${esc}\\)`, "g"), "");
  }
  // Remove bare share/nav lines like "Share this article" links
  s = s.replace(/^\s*\[.*?(share|subscribe|newsletter|follow us).*?\]\(.*?\)\s*$/gim, "");
  // Collapse >2 blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function ReadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-3 bg-muted rounded w-11/12" />
      <div className="h-3 bg-muted rounded w-10/12" />
      <div className="h-3 bg-muted rounded w-9/12" />
      <div className="h-3 bg-muted rounded w-11/12" />
      <div className="h-3 bg-muted rounded w-8/12" />
      <div className="h-40 bg-muted rounded-xl mt-4" />
      <div className="h-3 bg-muted rounded w-11/12" />
      <div className="h-3 bg-muted rounded w-10/12" />
    </div>
  );
}

function NewsReaderPage() {
  const { url, title, source, image, publishedAt } = Route.useSearch();

  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["news-reader", url],
    queryFn: async () => {
      const res = await fetch(`/api/news/read?url=${encodeURIComponent(url)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed to load article");
      return j as { markdown: string };
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const cleaned = useMemo(() => cleanMarkdown(data?.markdown ?? "", image), [data?.markdown, image]);
  const readMins = useMemo(() => {
    const words = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
    return Math.max(1, Math.round(words / 220));
  }, [cleaned]);

  const share = async () => {
    const shareData = { title: title || "StudentsPlug News", text: title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied");
      }
    } catch {}
  };

  return (
    <AppShell>
      <article className="max-w-3xl mx-auto">
        <Link
          to="/news"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" /> All news
        </Link>

        {/* Glass hero card */}
        <header className="relative overflow-hidden rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 backdrop-blur-xl shadow-card mb-6">
          {image ? (
            <div className="relative aspect-[16/9] overflow-hidden">
              <img src={image} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            </div>
          ) : (
            <>
              <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/25 blur-3xl" aria-hidden />
              <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-sky-400/20 blur-3xl" aria-hidden />
            </>
          )}
          <div className="relative p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {source && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold uppercase tracking-wider">
                  <Globe2 className="w-3.5 h-3.5" /> {source}
                </span>
              )}
              {publishedAt && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="w-3.5 h-3.5" /> {readMins} min read
              </span>
            </div>
            {title && (
              <h1 className="text-2xl sm:text-4xl font-display font-black leading-[1.1] bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                {title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-glow hover:opacity-90 transition"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-background/70 backdrop-blur border hover:bg-accent transition"
              >
                Original <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </header>

        {/* Body card */}
        <section className="relative rounded-3xl border border-white/20 dark:border-white/10 bg-card/60 backdrop-blur-xl shadow-card p-5 sm:p-8">
          {isFetching && !data ? (
            <ReadingSkeleton />
          ) : isError ? (
            <div className="text-center py-8">
              <p className="font-bold text-lg">This article can't be read here.</p>
              <p className="text-sm text-muted-foreground mt-1">Go to the original page to continue.</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-full bg-primary text-primary-foreground shadow-glow"
              >
                Go to original page <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div
              className="
                prose prose-sm sm:prose-base max-w-none dark:prose-invert
                prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:leading-relaxed prose-p:text-foreground/90
                prose-a:text-primary prose-a:font-semibold hover:prose-a:underline
                prose-strong:text-foreground prose-strong:font-bold
                prose-em:text-foreground/90
                prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic
                prose-img:rounded-2xl prose-img:shadow-card prose-img:mx-auto
                prose-figure:rounded-2xl
                prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-muted prose-code:before:content-none prose-code:after:content-none
                prose-pre:rounded-2xl prose-pre:border prose-pre:bg-muted
                prose-ul:marker:text-primary prose-ol:marker:text-primary
                prose-li:my-1
                prose-hr:border-border/60
                prose-table:overflow-hidden prose-table:rounded-2xl prose-table:border prose-table:border-border
                prose-thead:bg-muted/70
                prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-bold
                prose-td:px-3 prose-td:py-2 prose-td:border-t prose-td:border-border/60
              "
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Wrap tables so they scroll horizontally on mobile
                  table: ({ node, ...props }) => (
                    <div className="not-prose overflow-x-auto my-4 rounded-2xl border border-border">
                      <table className="w-full text-sm" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="px-3 py-2 text-left font-bold bg-muted/70 border-b border-border" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="px-3 py-2 border-t border-border/60 align-top" {...props} />
                  ),
                  img: ({ node, ...props }) => (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <img loading="lazy" {...props} className="rounded-2xl shadow-card mx-auto my-4" />
                  ),
                  // Article body links are non-navigable — render as plain styled text.
                  a: ({ node, children, ...props }) => (
                    <span
                      {...(props as any)}
                      className="text-primary font-semibold underline decoration-primary/30 underline-offset-2 cursor-default"
                    >
                      {children}
                    </span>
                  ),
                }}
              >
                {cleaned}
              </ReactMarkdown>
            </div>
          )}
        </section>

        {data && !isError && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-white/20 dark:border-white/10 bg-card/60 backdrop-blur-xl">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Original source</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all inline-flex items-center gap-1"
              >
                {url} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <button
              onClick={share}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-primary text-primary-foreground shadow-glow"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        )}
      </article>
    </AppShell>
  );
}
