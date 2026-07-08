import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { BookOpen, Loader2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize-html";

type PreviewBook = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_url: string | null;
  book_type: string;
  status: string;
  chapters: Array<{ id: string; idx: number; title: string; content: string }>;
};

export const Route = createFileRoute("/books_/preview/$token")({
  component: PreviewPage,
  head: () => ({
    meta: [
      { title: "Draft preview — StudentsPlug" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function PreviewPage() {
  const { token } = Route.useParams();
  const [idx, setIdx] = useState(0);

  const { data, isLoading, error } = useQuery<PreviewBook | null>({
    queryKey: ["book-preview", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_book_by_share_token" as any, { _token: token });
      if (error) throw error;
      return data as PreviewBook | null;
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 inline animate-spin" /> Loading preview…
        </p>
      </AppShell>
    );
  }
  if (error || !data) {
    return (
      <AppShell>
        <div className="text-center py-16 space-y-2">
          <Lock className="w-10 h-10 mx-auto opacity-40" />
          <p className="font-semibold">Preview link is invalid or has been revoked.</p>
          <p className="text-sm text-muted-foreground">Ask the author for a fresh link.</p>
        </div>
      </AppShell>
    );
  }

  const chapters = data.chapters ?? [];
  const active = chapters[Math.max(0, Math.min(idx, chapters.length - 1))];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Lock className="w-3 h-3" /> DRAFT PREVIEW · read-only
        </div>
        <div className="bg-card border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-4">
          <div className="aspect-[2/3] bg-muted rounded-xl overflow-hidden">
            <BookCover title={data.title} src={data.cover_url} className="h-full w-full" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold font-display">{data.title}</h1>
            {data.subtitle && <p className="text-sm text-muted-foreground">{data.subtitle}</p>}
            {data.description && <p className="text-sm mt-2 whitespace-pre-wrap">{data.description}</p>}
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-muted capitalize">
              {data.book_type}
            </span>
          </div>
        </div>

        {chapters.length === 0 ? (
          <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No chapters yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <aside className="bg-card border rounded-2xl p-3 space-y-1 h-fit md:sticky md:top-20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                Chapters
              </span>
              {chapters.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setIdx(i)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
                    i === idx ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                  <span className="flex-1 truncate">{c.title || "Untitled"}</span>
                </button>
              ))}
            </aside>
            <section className="bg-card border rounded-2xl p-6 md:p-8 min-h-[60vh]">
              {active && (
                <>
                  <h2 className="font-display text-2xl font-bold mb-4">{active.title}</h2>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(active.content) || "<p><em>Empty chapter.</em></p>" }}
                  />
                  <div className="mt-8 pt-4 border-t flex items-center justify-between">
                    <button
                      disabled={idx === 0}
                      onClick={() => setIdx((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full hover:bg-muted disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {idx + 1} / {chapters.length}
                    </span>
                    <button
                      disabled={idx >= chapters.length - 1}
                      onClick={() => setIdx((i) => Math.min(chapters.length - 1, i + 1))}
                      className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-full hover:bg-muted disabled:opacity-40"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
