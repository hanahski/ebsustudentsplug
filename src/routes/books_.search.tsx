import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { BookCover } from "@/components/BookCover";
import { Input } from "@/components/ui/input";
import { getLibraryBooks } from "@/lib/library-books.functions";
import { Search, BookOpen, Info, Coins, ArrowLeft } from "lucide-react";

const searchSchema = z.object({
  course: z.string().optional().default(""),
  q: z.string().optional().default(""),
});

export const Route = createFileRoute("/books_/search")({
  validateSearch: searchSchema,
  component: BookSearchPage,
  head: () => ({
    meta: [
      { title: "Book Search — StudentsPlug" },
      { name: "description", content: "Find open textbooks and novels tuned to your course." },
    ],
  }),
});

// Course name → simple keyword tokens for smart matching.
// Removes generic words like "education", "department", "and".
const STOP = new Set(["education", "and", "of", "the", "for", "studies", "science", "sciences", "department"]);
function tokensFromCourse(course: string): string[] {
  const toks = course
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
  // Always include the raw course too — helps for "Computer Education" → "computer".
  return Array.from(new Set(toks));
}

function BookSearchPage() {
  const { course, q } = Route.useSearch();
  const [term, setTerm] = useState(q || course || "");
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(t);
  }, [term]);

  const getBooksFn = useServerFn(getLibraryBooks);
  const tokens = useMemo(() => (course ? tokensFromCourse(course) : []), [course]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["book-search", course, debounced],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Fire one query per keyword, merge unique by id.
      const keywords = debounced ? [debounced, ...tokens] : tokens;
      const uniq: any[] = [];
      const seen = new Set<string>();
      const runs = (keywords.length ? keywords : [""]).slice(0, 4);
      for (const k of runs) {
        const rows = await getBooksFn({
          data: { category: "all", tag: "all", query: k, limit: 60 },
        });
        for (const r of rows as any[]) {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            uniq.push(r);
          }
        }
      }
      return uniq;
    },
  });

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/faculties"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Catalogue
          </Link>
          <Link to="/books" className="text-xs text-muted-foreground hover:text-primary">
            All books →
          </Link>
        </div>

        <header className="rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6 shadow-card">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            <BookOpen className="w-3 h-3" /> Book search
          </div>
          <h1 className="mt-1 text-2xl font-bold font-display leading-tight">
            {course ? (
              <>Books for <span className="text-primary">{course}</span></>
            ) : (
              "Search the open library"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every open source (OpenStax, Gutenberg, LibreTexts, BCcampus, Open Textbook Library, EBSU
            uploads) shown as one shelf — auto-filtered to what best fits your course.
          </p>

          <div className="relative mt-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Refine — try a topic, author, edition…"
              className="pl-9 h-11 rounded-full bg-background/70 backdrop-blur"
            />
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-800 dark:text-amber-200 leading-snug">
              Mind you — most of these books are foreign. Use them as reference or supplemental
              reading. For EBSU-specific past questions and notes, check your course page.
            </p>
          </div>
        </header>

        {isFetching && !results && (
          <p className="text-center text-muted-foreground py-8">Searching the shelves…</p>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-16 text-muted-foreground bg-card border rounded-2xl">
            <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No books matched — try a broader keyword.</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(results ?? []).map((b: any) => (
            <Link
              key={b.id}
              to="/books/read/$id"
              params={{ id: b.id }}
              className="bg-card border rounded-2xl overflow-hidden shadow-card hover:shadow-glow hover:-translate-y-0.5 transition flex flex-col"
            >
              <div className="aspect-[2/3] bg-muted overflow-hidden">
                <BookCover title={b.title} author={b.author} src={b.cover_url} className="w-full h-full" />
              </div>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <h3 className="text-sm font-semibold line-clamp-2 leading-tight">{b.title}</h3>
                {b.author && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{b.author}</p>
                )}
                <div className="flex items-center justify-between text-[10px] mt-auto pt-1">
                  <span className="capitalize px-2 py-0.5 rounded-full bg-muted">{b.category}</span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                    <Coins className="w-3 h-3" /> {b.price_credits ?? 0}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
