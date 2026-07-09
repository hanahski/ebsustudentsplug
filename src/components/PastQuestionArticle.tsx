import { Link } from "@tanstack/react-router";
import { Copy, Download, Eye, Users, Printer, Share2, ListOrdered, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { parsePastQuestion, extractYear } from "@/lib/past-question-format";
import { downloadPastQuestionPdf } from "@/lib/past-question-pdf";
import { MathText } from "@/components/MathText";
import { AvatarDisplay } from "@/components/AvatarDisplay";

export type PastQuestionArticleProps = {
  note: {
    title: string;
    body: string;
    created_at: string;
    course: { code: string; title: string } | null;
    faculty: string | null;
    department: string | null;
  };
  audience?: {
    count: number;
    viewers: Array<{ id: string; display_name: string; avatar_key: string; at: string }>;
  } | null;
};

export function PastQuestionArticle({ note, audience = null }: PastQuestionArticleProps) {
  const parsed = parsePastQuestion(note.body);
  const year = extractYear(note.body);
  const code = note.course?.code ?? note.title.split("—")[0]?.trim() ?? "EBSU";
  const courseTitle = note.course?.title ?? note.title;

  const containerRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  // Reading progress + back-to-top visibility.
  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = Math.max(1, rect.height - vh);
      const scrolled = Math.min(total, Math.max(0, -rect.top));
      setProgress((scrolled / total) * 100);
      setShowTop(window.scrollY > 480);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const toc = useMemo(() => {
    const items: Array<{ id: string; label: string; kind: "section" | "question" }> = [];
    parsed.blocks.forEach((b, i) => {
      if (b.kind === "section") items.push({ id: `sec-${i}`, label: b.label, kind: "section" });
      if (b.kind === "question") items.push({ id: `q-${b.number}`, label: `Question ${b.number}`, kind: "question" });
    });
    return items;
  }, [parsed.blocks]);

  const onDownload = () => {
    try {
      downloadPastQuestionPdf({
        title: note.title,
        body: note.body,
        course: { code, title: courseTitle },
        faculty: note.faculty,
        department: note.department,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't build PDF");
    }
  };

  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: `${code} — ${courseTitle}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch { /* cancelled */ }
  };

  const questionCount = parsed.blocks.filter((b) => b.kind === "question").length;

  return (
    <>
      {/* Reading progress bar */}
      <div className="pq-progress" style={{ width: `${progress}%` }} aria-hidden />

      <article ref={containerRef} className="bg-card border rounded-2xl shadow-card max-w-3xl overflow-hidden a-fade-up">
        <header className="relative bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 overflow-hidden">
          {/* Decorative radial glow */}
          <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-black/10 blur-3xl" />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-90">
              Ebonyi State University · Past Question
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display mt-2 leading-tight">
              {code} — {courseTitle}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {note.faculty && (
                <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full">{note.faculty}</span>
              )}
              {note.department && (
                <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full">{note.department}</span>
              )}
              {year && <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full">Session {year}</span>}
              {questionCount > 0 && (
                <span className="bg-white/15 backdrop-blur px-2 py-1 rounded-full">{questionCount} questions</span>
              )}
            </div>
          </div>
        </header>

        <div className="p-6 print:p-0">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-5 print:hidden">
            <Button size="sm" onClick={onDownload} className="post-tap">
              <Download className="w-3.5 h-3.5 mr-1" /> Download PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="post-tap"
              onClick={() => {
                navigator.clipboard.writeText(note.body);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1" /> Copy text
            </Button>
            <Button size="sm" variant="outline" className="post-tap" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Print
            </Button>
            <Button size="sm" variant="outline" className="post-tap" onClick={onShare}>
              <Share2 className="w-3.5 h-3.5 mr-1" /> Share
            </Button>
            {toc.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="post-tap ml-auto"
                onClick={() => setTocOpen((s) => !s)}
                aria-expanded={tocOpen}
              >
                <ListOrdered className="w-3.5 h-3.5 mr-1" /> Contents ({toc.length})
              </Button>
            )}
          </div>

          {/* Collapsible TOC */}
          {tocOpen && toc.length > 0 && (
            <nav className="mb-6 rounded-xl border bg-muted/30 p-3 a-fade-up print:hidden">
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      onClick={() => setTocOpen(false)}
                      className={`block truncate px-2 py-1 rounded-md hover:bg-primary/10 hover:text-primary ${t.kind === "section" ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {t.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {parsed.meta.length > 0 && (
            <div className="rounded-xl border bg-muted/40 p-4 mb-6 text-sm leading-relaxed space-y-1">
              {parsed.meta.map((m, i) => (
                <p key={i} className="text-muted-foreground">{m}</p>
              ))}
            </div>
          )}

          {parsed.blocks.length === 0 && parsed.header.length > 0 && (
            <div className="space-y-3 text-[15px] leading-7 mb-4">
              {parsed.header.map((line, i) => (
                <MathText key={i} className="leading-7">{line}</MathText>
              ))}
            </div>
          )}

          {parsed.blocks.length === 0 && parsed.header.length === 0 && note.body?.trim() && (
            <div className="text-[15px] leading-7 whitespace-pre-wrap">
              <MathText className="leading-7">{note.body}</MathText>
            </div>
          )}

          <div className="space-y-4 text-[15px] leading-7">
            {parsed.blocks.map((b, i) => {
              if (b.kind === "section") {
                return (
                  <h2
                    key={i}
                    id={`sec-${i}`}
                    className="mt-6 pb-1 border-b-2 border-primary/40 text-sm font-bold uppercase tracking-wider text-primary scroll-mt-20"
                  >
                    {b.label}
                  </h2>
                );
              }
              if (b.kind === "question") {
                return (
                  <div key={i} id={`q-${b.number}`} className="group flex gap-3 scroll-mt-20 rounded-lg -mx-2 px-2 py-1 hover:bg-muted/30 transition-colors">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {b.number}
                    </span>
                    <div className="flex-1"><MathText className="leading-7">{b.text}</MathText></div>
                  </div>
                );
              }
              return (
                <MathText key={i} className="text-muted-foreground leading-7">{b.text}</MathText>
              );
            })}
          </div>

          {audience && (
            <section className="mt-8 pt-5 border-t print:hidden">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Audience
                  <span className="text-xs font-normal text-muted-foreground">· who opened this</span>
                </h3>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                  <Eye className="w-3.5 h-3.5" /> {audience.count} {audience.count === 1 ? "view" : "views"}
                </span>
              </div>
              {audience.viewers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No one has opened this note yet.</p>
              ) : (
                <ul className="space-y-2">
                  {audience.viewers.slice(0, 12).map((v) => (
                    <li key={v.id + v.at} className="flex items-center gap-3">
                      <Link to="/profile/$id" params={{ id: v.id }} className="shrink-0">
                        <AvatarDisplay avatarKey={v.avatar_key} size={28} />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link to="/profile/$id" params={{ id: v.id }} className="text-sm font-semibold truncate hover:underline">
                          {v.display_name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">read {formatDistanceToNow(new Date(v.at), { addSuffix: true })}</p>
                      </div>
                    </li>
                  ))}
                  {audience.viewers.length > 12 && (
                    <li className="text-xs text-muted-foreground pl-10">+ {audience.viewers.length - 12} more</li>
                  )}
                </ul>
              )}
            </section>
          )}

          <footer className="mt-8 pt-4 border-t text-[11px] text-muted-foreground">
            Saved {new Date(note.created_at).toISOString().slice(0, 10)} · StudentsPlug
          </footer>
        </div>
      </article>

      {/* Back to top */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-4 z-40 w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center post-tap a-fade-up print:hidden"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
