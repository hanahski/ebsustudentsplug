import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, Crown } from "lucide-react";

const TABS = [
  { to: "/faculties", label: "Department/Course", icon: GraduationCap },
  { to: "/school-biography", label: "School Biography", icon: Crown },
] as const;

export function CatalogueTabs() {
  const { pathname } = useLocation();
  const activeIdx = TABS.findIndex((t) => pathname.startsWith(t.to));
  const idx = activeIdx === -1 ? 0 : activeIdx;

  return (
    <div className="sticky top-14 z-30 -mx-2 px-2 pt-2 pb-3 bg-background/85 backdrop-blur">
      <div className="relative mx-auto max-w-xl grid grid-cols-2 rounded-full border bg-muted/60 p-1 shadow-sm">
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-r from-primary to-accent shadow-glow transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${idx * 100}%)` }}
        />
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const active = i === idx;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`relative z-10 flex items-center justify-center gap-1.5 h-9 rounded-full text-xs font-bold transition-colors duration-300 ${
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 transition-transform duration-300 ${active ? "scale-110" : ""}`} />
              <span className="truncate">{t.label}</span>
              {active && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
