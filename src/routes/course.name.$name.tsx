import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BookOpen, MessageSquare, Users, ClipboardList, FileQuestion, Gamepad2, GraduationCap, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/course/name/$name")({
  component: CourseByNamePage,
  head: ({ params }) => ({
    meta: [
      { title: `${decodeURIComponent(params.name)} — Course Page` },
      {
        name: "description",
        content: `Everything you need for ${decodeURIComponent(params.name)} at EBSU — books, notes, past questions and discussion.`,
      },
    ],
  }),
});

function CourseByNamePage() {
  const { name } = Route.useParams();
  const decoded = decodeURIComponent(name);

  const features: Array<{ icon: any; title: string; blurb: string; to: any; search?: any; tone: string }> = [
    {
      icon: BookOpen,
      title: "Study material",
      blurb: "Lecture notes and handouts shared by students.",
      to: "/notes",
      tone: "from-emerald-500 to-teal-600",
    },
    {
      icon: FileQuestion,
      title: "Past questions",
      blurb: "Previous exam papers to test yourself with.",
      to: "/search",
      search: { q: `${decoded} past question` },
      tone: "from-rose-500 to-pink-600",
    },
    {
      icon: ClipboardList,
      title: "Assignments",
      blurb: "Assignments and coursework tasks posted here.",
      to: "/search",
      search: { q: `${decoded} assignment` },
      tone: "from-amber-500 to-orange-600",
    },
    {
      icon: MessageSquare,
      title: "Discussion",
      blurb: "Ask questions, share tips, help other students.",
      to: "/search",
      search: { q: decoded },
      tone: "from-sky-500 to-indigo-600",
    },
    {
      icon: Users,
      title: "Create a study group",
      blurb: "Open a chat group with classmates.",
      to: "/chat",
      search: { tab: "dms", newGroup: true, groupName: decoded },
      tone: "from-violet-500 to-purple-700",
    },
    {
      icon: Gamepad2,
      title: "Play & earn",
      blurb: "Take a break — play games and earn credits.",
      to: "/games",
      tone: "from-fuchsia-500 to-rose-600",
    },
  ];

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link to="/faculties" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          ← Back to catalogue
        </Link>

        <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-card p-6 sm:p-8 shadow-card">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="relative flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 text-primary-foreground flex items-center justify-center shadow-glow">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Course
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold font-display leading-tight">
                {decoded}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your home base for {decoded} — study material, past questions, discussion and more.
              </p>
            </div>
          </div>
        </header>

        {/* Prominent book search card */}
        <Link
          to="/books/search"
          search={{ course: decoded } as any}
          className="group block relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all"
        >
          <div className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-4 flex-wrap justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-[220px]">
              <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">
                  Book search
                </p>
                <p className="text-lg font-bold font-display leading-tight">
                  Browse books under this course
                </p>
                <p className="text-xs text-white/85 mt-0.5">
                  Every open library filtered to {decoded}.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1 text-sm font-semibold group-hover:gap-2 transition-all">
              Open <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              search={f.search as any}
              className="group bg-card border rounded-2xl p-4 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all flex flex-col"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.tone} text-white flex items-center justify-center mb-3 shadow`}>
                <f.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold group-hover:text-primary">{f.title}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{f.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
