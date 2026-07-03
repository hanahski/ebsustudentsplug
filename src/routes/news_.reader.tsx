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

// Clean r.jina.ai markdown: strip nav/menu chrome, related-story lists,
// promos, footer boilerplate — keep only the main article body.
const NAV_WORDS = [
  "skip to content", "skip to main", "menu", "main menu", "primary navigation",
  "watch live", "listen live", "sign in", "log in", "log out", "sign up",
  "subscribe", "subscribe now", "newsletter", "sign up for our newsletter",
  "follow us", "follow", "share this article", "share this", "share",
  "advertisement", "sponsored", "promoted",
  "site search", "search", "site map", "sitemap",
  "home", "news", "sport", "sports", "business", "technology", "tech",
  "health", "science", "culture", "arts", "travel", "earth", "weather",
  "audio", "video", "live", "documentaries", "opinion", "politics",
  "world", "uk", "us", "africa", "asia", "europe", "middle east",
  "entertainment", "lifestyle", "style", "fashion", "food", "climate",
  "football", "football 2026", "cricket", "tennis", "formula 1", "f1",
  "back to top", "top stories", "most read", "most watched", "most popular",
  "related stories", "related articles", "related topics", "related",
  "read more", "more from", "more stories", "more on this story",
  "cookies", "cookie policy", "privacy policy", "terms of use", "terms",
  "contact us", "about us", "about", "help", "accessibility",
  "copyright", "all rights reserved",
  "image source", "image caption", "getty images", "reuters", "afp",
  "comments", "leave a comment", "post a comment",
];

function isNavLine(raw: string): boolean {
  const line = raw.trim().replace(/^[-*+>#•·|]+\s*/, "").replace(/[:•·|]+$/, "").trim();
  if (!line) return false;
  // Strip a single wrapping [text](url) markdown link → text
  const linkOnly = line.match(/^\[([^\]]+)\]\([^)]+\)$/);
  const candidate = (linkOnly ? linkOnly[1] : line).toLowerCase().trim();
  if (!candidate) return false;
  // Very short lines that are a single nav word/phrase
  if (candidate.length <= 32 && NAV_WORDS.includes(candidate)) return true;
  // Standalone very short link-only lines are almost always nav
  if (linkOnly && candidate.split(/\s+/).length <= 4 && candidate.length <= 28) return true;
  return false;
}

function cleanMarkdown(md: string, heroImage?: string): string {
  if (!md) return md;
  let s = md;

  // Remove the hero image if it's duplicated in the body
  if (heroImage) {
    const esc = heroImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`!\\[[^\\]]*\\]\\(${esc}\\)`, "g"), "");
  }

  // Split, drop nav-ish lines, keep paragraphs
  const lines = s.split("\n");
  const kept: string[] = [];
  for (const l of lines) {
    if (isNavLine(l)) continue;
    kept.push(l);
  }
  s = kept.join("\n");

  // Cut everything after common "related" / "read more" section headers
  s = s.replace(
    /\n\s*#{1,6}\s*(related( stories| articles| topics)?|more (on this story|from|stories)|most (read|watched|popular)|top stories|read more|comments)\b[\s\S]*$/i,
    "",
  );

  // Trim leading nav soup: drop everything before the first real paragraph
  // (a paragraph = a line with 12+ words, not starting with '#' or '!')
  const paraLines = s.split("\n");
  let firstReal = -1;
  for (let i = 0; i < paraLines.length; i++) {
    const t = paraLines[i].trim();
    if (!t) continue;
    if (t.startsWith("#") || t.startsWith("![") || t.startsWith(">")) continue;
    if (t.split(/\s+/).length >= 12) { firstReal = i; break; }
  }
  if (firstReal > 0) {
    // Preserve any heading (#) that sits within the 3 lines just before the first paragraph
    const headStart = Math.max(0, firstReal - 3);
    const preamble = paraLines.slice(headStart, firstReal).filter((l) => l.trim().startsWith("#"));
    s = [...preamble, ...paraLines.slice(firstReal)].join("\n");
  }

  // Collapse blank lines
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
              {(() => {
                const mdComponents = {
                  table: ({ node, ...props }: any) => (
                    <div className="not-prose overflow-x-auto my-4 rounded-2xl border border-border">
                      <table className="w-full text-sm" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }: any) => (
                    <th className="px-3 py-2 text-left font-bold bg-muted/70 border-b border-border" {...props} />
                  ),
                  td: ({ node, ...props }: any) => (
                    <td className="px-3 py-2 border-t border-border/60 align-top" {...props} />
                  ),
                  img: ({ node, ...props }: any) => (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <img loading="lazy" {...props} className="rounded-2xl shadow-card mx-auto my-4" />
                  ),
                  a: ({ node, children, ...props }: any) => (
                    <span
                      {...(props as any)}
                      className="text-primary font-semibold underline decoration-primary/30 underline-offset-2 cursor-default"
                    >
                      {children}
                    </span>
                  ),
                } as any;
                return (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {cleaned}
                  </ReactMarkdown>
                );
              })()}
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
