import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Search, GraduationCap, Sparkles } from "lucide-react";

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

function Catalogue() {
  const [q, setQ] = useState("");

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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return DEPARTMENTS.filter((d) => !query || d.toLowerCase().includes(query))
      .slice()
      .sort((a, b) => a.localeCompare(b));
  }, [q]);

  const grouped = useMemo(() => {
    const buckets: Record<string, string[]> = {};
    for (const name of filtered) {
      const letter = name[0].toUpperCase();
      (buckets[letter] ??= []).push(name);
    }
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const letters = grouped.map(([l]) => l);

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
                Departments,{" "}
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  A&nbsp;to&nbsp;Z
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {DEPARTMENTS.length} programmes at Ebonyi State University.
              </p>
            </div>
          </div>

          {/* Search + A–Z rail */}
          <div className="relative mt-5 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a department (e.g. Computer Science)"
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

        {/* Groups */}
        {grouped.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No department matches "{q}".
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
                  const inner = (
                    <div className="group h-full flex items-center gap-3 bg-card border rounded-2xl p-3 pr-4 shadow-card hover:shadow-glow hover:-translate-y-0.5 transition-all">
                      <DeptGlyph name={name} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm leading-snug group-hover:text-primary truncate">
                          {name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Programme · EBSU
                        </div>
                      </div>
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </div>
                  );
                  return (
                    <li key={name}>
                      {id ? (
                        <Link to="/department/$id" params={{ id }}>{inner}</Link>
                      ) : (
                        <Link to="/search" search={{ q: name } as any}>{inner}</Link>
                      )}
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
