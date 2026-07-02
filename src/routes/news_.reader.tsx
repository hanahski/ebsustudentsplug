import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, ExternalLink, Loader2, Calendar, Globe2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";

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
  });

  return (
    <AppShell>
      <article className="max-w-3xl mx-auto">
        <Link to="/news" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> All news
        </Link>

        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-2">
          <Globe2 className="w-3.5 h-3.5" /> {source || "Web"}
        </div>
        {title && (
          <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight mb-3">{title}</h1>
        )}
        {publishedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
          </div>
        )}

        {image && (
          <img src={image} alt="" className="w-full rounded-2xl mb-6 shadow-card" />
        )}

        {isFetching && !data ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading the story…
          </div>
        ) : isError ? (
          <div className="bg-card border rounded-2xl p-6 text-center">
            <p className="font-bold">Couldn't extract this article.</p>
            <p className="text-sm text-muted-foreground mt-1">The site may block readers. You can open the original page instead.</p>
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={() => refetch()} className="text-sm font-bold px-3 py-1.5 rounded-md bg-primary text-primary-foreground">Retry</button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold px-3 py-1.5 rounded-md border inline-flex items-center gap-1">
                Open original <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-display prose-img:rounded-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data?.markdown ?? ""}</ReactMarkdown>
            </div>
            <div className="mt-8 pt-6 border-t">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 break-all">
                Original source: {url} <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </>
        )}
      </article>
    </AppShell>
  );
}
