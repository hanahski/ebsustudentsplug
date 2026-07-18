import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, GraduationCap, Sparkles, Crown, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/faculties")({
  component: Catalogue,
  head: () => ({
    meta: [
      { title: "Departments Catalogue — StudentsPlug" },
      { name: "description", content: "Browse every EBSU department, A to Z." },
    ],
  }),
});

// Canonical list — grouped and rendered A→Z on the client.
const DEPARTMENTS: string[] = [
  "Accountancy","Accountancy Education","Admin and Planning",
  "Agric Economics, Management and Extension","Agric Education","Anatomy",
  "Animal Science","Applied Biology","Applied Microbiology","Applied Statistics","Architecture",
  "Banking and Finance","Biochemistry","Biotechnology","Building","Building Technology Education","Business Management",
  "Chemical Engineering","Civil Engineering","Computer Science","Crop Science and Landscape Management",
  "Economics","Education Biology","Education Chemistry","Education Computer Science","Education Economics",
  "Education English Language","Education Igbo","Education Integrated Science","Education Mathematics",
  "Education Physics","Education Religious Studies","Education Social Studies",
  "Electrical and Electronics Engineering","Electrical Electronics Technology Education",
  "English Language & Literature","Entrepreneurship","Environmental Management","Estate Management",
  "Film Production","Fisheries and Aquaculture","Food Science and Technology","French",
  "Geology and Exploration Geophysics","Guidance and Counselling",
  "Health Education","History and International Relations","Home Economics","Human Kinetics",
  "Igbo","Industrial Chemistry","Industrial Mathematics","Industrial Physics",
  "Law","Library & Information Science","Linguistics",
  "Marketing","Mass Communication","Mechanical / Automobile Technology Education",
  "Mechanical Metalwork Technology Education","Medical Laboratory Science","Medicine and Surgery",
  "Nursing Science",
  "Philosophy","Physiology","Political Science","Psychology","Public Administration",
  "Religion and Peace Studies",
  "Secretarial Studies Education","Social Work","Sociology & Anthropology",
  "Soil and Environmental Management","Special Education",
  "Theatre Art",
  "Woodwork Education",
];

// Deterministic pastel accent per department (hue derived from name hash).
function accentFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    from: `hsl(${hue} 80% 60%)`,
    to: `hsl(${(hue + 32) % 360} 78% 48%)`,
    tint: `hsl(${hue} 78% 96%)`,
    tintDark: `hsl(${hue} 40% 14%)`,
  };
}

/** Smart glyph — monogram inside a rounded gradient tile with subtle grid + a
 *  small orbit dot. Reads as a professional catalogue icon, not an emoji. */
function DeptGlyph({ name }: { name: string }) {
  const words = name.replace(/[/&]/g, " ").split(/\s+/).filter(Boolean);
  const initials =
    (words[0]?.[0] ?? "?") + (words[1]?.[0] ?? words[0]?.[1] ?? "");
  const a = accentFor(name);
  const gid = `g-${initials}-${name.length}`;
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a.from} />
          <stop offset="100%" stopColor={a.to} />
        </linearGradient>
        <pattern id={`p-${gid}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8H8" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
          <path d="M8 0V8" stroke="rgba(255,255,255,.14)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="16" fill={`url(#${gid})`} />
      <rect x="1" y="1" width="62" height="62" rx="16" fill={`url(#p-${gid})`} />
      {/* corner arc — suggests learning trajectory */}
      <path d="M8 56 Q 8 20 44 12" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" fill="none" />
      <circle cx="44" cy="12" r="2" fill="#fff" />
      {/* monogram */}
      <text
        x="32" y="40" textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="800" fontSize="22" fill="#fff"
        style={{ letterSpacing: "-0.5px" }}
      >
        {initials.toUpperCase()}
      </text>
    </svg>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function SwipeToBio({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const [locked, setLocked] = useState<null | "h" | "v">(null);
  const THRESHOLD = 80;

  const reset = () => { startX.current = null; startY.current = null; setDx(0); setLocked(null); };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      onTouchStart={(e) => {
        const t = e.touches[0];
        startX.current = t.clientX; startY.current = t.clientY; setLocked(null); setDx(0);
      }}
      onTouchMove={(e) => {
        if (startX.current == null || startY.current == null) return;
        const t = e.touches[0];
        const rawDx = t.clientX - startX.current;
        const rawDy = t.clientY - startY.current;
        if (locked == null) {
          if (Math.abs(rawDx) > 8 || Math.abs(rawDy) > 8) {
            setLocked(Math.abs(rawDx) > Math.abs(rawDy) ? "h" : "v");
          }
        }
        if (locked === "h" && rawDx < 0) {
          e.preventDefault();
          setDx(Math.max(rawDx, -140));
        }
      }}
      onTouchEnd={() => {
        if (locked === "h" && dx <= -THRESHOLD) {
          navigate({ to: "/school-biography" });
        }
        reset();
      }}
      onTouchCancel={reset}
    >
      {/* Reveal layer */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 pointer-events-none"
        style={{ width: Math.min(140, Math.abs(dx)), opacity: Math.min(1, Math.abs(dx) / THRESHOLD) }}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-primary-foreground bg-primary rounded-full px-2.5 py-1 shadow-glow">
          <Crown className="w-3 h-3" />
          School Bio
        </div>
      </div>
      <div style={{ transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform 200ms ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}

function Catalogue() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"departments" | "courses">("departments");

  // Map department name → real DB id when it exists, so cards deep-link.
  const { data: dbDepts } = useQuery({
    queryKey: ["catalogue-departments"],
    queryFn: async () =>
      (await supabase.from("departments").select("id,name")).data ?? [],
    staleTime: 5 * 60_000,
  });
  const idByName = useMemo(() => {
    const m = new Map<string, string>();
    (dbDepts ?? []).forEach((d: any) => m.set(d.name.toLowerCase().trim(), d.id));
    return m;
  }, [dbDepts]);

  // Any programme whose name contains "Education" is a teaching/course
  // programme — split them from pure departments.
  const isCourse = (name: string) => /\beducation\b/i.test(name);
  const source = useMemo(
    () => DEPARTMENTS.filter((d) => (mode === "courses" ? isCourse(d) : !isCourse(d))),
    [mode],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return source
      .filter((d) => !query || d.toLowerCase().includes(query))
      .slice()
      .sort((a, b) => a.localeCompare(b));
  }, [q, source]);

  const grouped = useMemo(() => {
    const buckets: Record<string, string[]> = {};
    for (const name of filtered) {
      const letter = name[0].toUpperCase();
      (buckets[letter] ??= []).push(name);
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const letters = grouped.map(([l]) => l);
  const deptCount = DEPARTMENTS.filter((d) => !isCourse(d)).length;
  const courseCount = DEPARTMENTS.filter(isCourse).length;


  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/12 via-card to-card p-6 shadow-card">
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-accent/20 blur-3xl" aria-hidden />
          <div className="relative flex items-start gap-4 flex-wrap">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-glow">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> Catalogue
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold font-display leading-tight">
                EBSU{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Catalogue
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {deptCount} departments · {courseCount} courses.
              </p>
            </div>
          </div>

          {/* Category tabs */}
          <div className="relative mt-5 inline-flex p-1 rounded-full bg-muted/60 border shadow-sm">
            {([
              { key: "departments", label: "Departments", count: deptCount, hint: "See what EBSU offers" },
              { key: "courses", label: "Courses", count: courseCount, hint: "Where the real magic happens" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`px-4 h-9 rounded-full text-xs font-bold transition ${
                  mode === t.key
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={t.hint}
              >
                {t.label}
                <span className="ml-1.5 opacity-70">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search + A–Z rail */}
          <div className="relative mt-4 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={mode === "courses" ? "Search a course (e.g. Education Biology)" : "Search a department (e.g. Computer Science)"}
                className="pl-9 h-11 rounded-full bg-background/70 backdrop-blur"
              />
            </div>

            <nav
              aria-label="Jump to letter"
              className="flex flex-wrap gap-1 text-[11px] font-bold"
            >
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => {
                const active = letters.includes(L);
                return (
                  <a
                    key={L}
                    href={active ? `#letter-${L}` : undefined}
                    aria-disabled={!active}
                    className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition ${
                      active
                        ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
                        : "text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  >
                    {L}
                  </a>
                );
              })}
            </nav>
          </div>
        </header>

        {/* School Biography entry — the faces behind EBSU */}
        <Link
          to="/school-biography"
          className="group relative overflow-hidden rounded-3xl border bg-card p-4 md:p-5 flex items-center gap-4 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all"
        >
          <div
            className="absolute -top-12 -right-10 w-52 h-52 rounded-full blur-3xl opacity-40 group-hover:opacity-70 transition"
            style={{ background: "conic-gradient(from 0deg, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #f59e0b)" }}
            aria-hidden
          />
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-fuchsia-600 text-white flex items-center justify-center shadow-glow shrink-0">
            <Crown className="w-6 h-6" />
          </div>
          <div className="relative min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> New
            </div>
            <div className="font-bold text-base leading-tight mt-0.5">School Biography</div>
            <p className="text-xs text-muted-foreground truncate">
              SUG · DVCs · Course reps · Coordinators — meet the faces of EBSU.
            </p>
          </div>
          <ArrowRight className="relative w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
        </Link>

        {grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No {mode === "courses" ? "course" : "department"} matches "{q}".
          </div>
        ) : (
          grouped.map(([letter, items]) => (
            <section key={letter} id={`letter-${letter}`} className="scroll-mt-24">
              <div className="sticky top-14 z-10 -mx-2 px-2 py-2 bg-background/85 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center font-bold shadow-sm">
                    {letter}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {items.length}
                  </span>
                </div>
              </div>

              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {items.map((name) => {
                  const id = idByName.get(name.toLowerCase().trim());
                  const isOpenable = mode === "courses";
                  const inner = (
                    <div className={`group h-full flex items-center gap-3 bg-card border rounded-2xl p-3 pr-4 shadow-card transition-all ${isOpenable ? "hover:shadow-glow hover:-translate-y-0.5 cursor-pointer" : "opacity-95"}`}>
                      <DeptGlyph name={name} />
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold text-sm leading-snug truncate ${isOpenable ? "group-hover:text-primary" : ""}`}>
                          {name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {isOpenable ? "Course · EBSU · Tap to open" : "Department · EBSU"}
                        </div>
                      </div>
                      {isOpenable && (
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition"
                          fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round"
                        >
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                      )}
                    </div>
                  );
                  return (
                    <li key={name}>
                      <SwipeToBio>
                        {isOpenable ? (
                          <Link to="/course/name/$name" params={{ name }}>{inner}</Link>
                        ) : id ? (
                          <Link to="/department/$id" params={{ id }}>{inner}</Link>
                        ) : (
                          // Non-course departments are informational only.
                          <div>{inner}</div>
                        )}
                      </SwipeToBio>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
