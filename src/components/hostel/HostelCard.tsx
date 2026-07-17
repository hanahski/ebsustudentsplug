import {
  FEATURE_TOGGLES, CATEGORY_ICONS, scoreTier, overallScore,
  type HostelSpecs,
} from "@/lib/hostel-specs";
import { MapPin, ExternalLink, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/** Small circular score badge, glowing per tier. */
export function ScoreBadge({ value, size = "md", label }: { value: number; size?: "sm" | "md" | "lg"; label?: string }) {
  const t = scoreTier(value);
  const dims =
    size === "sm" ? "w-9 h-9 text-xs"
    : size === "lg" ? "w-16 h-16 text-2xl"
    : "w-12 h-12 text-base";
  const shadow =
    t.intensity === 2 ? `0 0 18px ${t.glow}, 0 0 6px ${t.glow}` :
    t.intensity === 1 ? `0 0 10px ${t.glow}` : "none";
  return (
    <div className="inline-flex flex-col items-center gap-0.5">
      <div
        className={cn("rounded-full font-black tabular-nums flex items-center justify-center border-2 bg-background/60 backdrop-blur", dims)}
        style={{
          color: t.color,
          borderColor: t.color,
          boxShadow: shadow,
          textShadow: t.intensity === 2 ? `0 0 8px ${t.glow}` : "none",
        }}
        title={`${label ?? "Score"} · ${t.label}`}
      >
        {value}
      </div>
      {label && <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>}
    </div>
  );
}

/** Compact hostel summary shown ON a product card. */
export function HostelCardStrip({ specs }: { specs: HostelSpecs }) {
  const overall = overallScore(specs.scores);
  const t = scoreTier(overall);
  const chips = specs.features.slice(0, 4);
  const more = Math.max(0, specs.features.length - chips.length);
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: t.color,
            border: `1px solid ${t.color}`,
            background: `${t.color}18`,
            boxShadow: t.intensity === 2 ? `0 0 10px ${t.glow}` : "none",
          }}
        >
          <Home className="w-3 h-3" /> {overall} · {t.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CATEGORY_ICONS.bedroom className="w-3 h-3" /> {specs.bedrooms} bd
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CATEGORY_ICONS.toilet className="w-3 h-3" /> {specs.toilets} bath
        </span>
        {specs.ac && <CATEGORY_ICONS.ac className="w-3 h-3 text-sky-400" />}
        {specs.kitchen && <CATEGORY_ICONS.kitchen className="w-3 h-3 text-amber-400" />}
        {specs.water_heater && <CATEGORY_ICONS.water_heater className="w-3 h-3 text-rose-400" />}
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((k) => {
            const f = FEATURE_TOGGLES.find((x) => x.key === k);
            if (!f) return null;
            const Icon = f.icon;
            return (
              <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-[9px] font-medium">
                <Icon className="w-2.5 h-2.5" /> {f.label}
              </span>
            );
          })}
          {more > 0 && <span className="text-[9px] text-muted-foreground font-semibold">+{more}</span>}
        </div>
      )}
    </div>
  );
}

/** Full-detail panel shown on the listing detail page. */
export function HostelDetailPanel({ specs }: { specs: HostelSpecs }) {
  const overall = overallScore(specs.scores);
  const scoreRows: { key: keyof HostelSpecs["scores"]; label: string; icon: typeof CATEGORY_ICONS.light }[] = [
    { key: "light",   label: "Light / Power",  icon: CATEGORY_ICONS.light },
    { key: "water",   label: "Water supply",   icon: CATEGORY_ICONS.water },
    { key: "safety",  label: "Safety",         icon: CATEGORY_ICONS.safety },
    { key: "network", label: "Network signal", icon: CATEGORY_ICONS.network },
  ];

  return (
    <div className="mt-6 space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            <Home className="w-3 h-3" /> Hostel details
          </div>
          <h3 className="mt-1 font-display font-bold text-base sm:text-lg">Living conditions</h3>
        </div>
        <ScoreBadge value={overall} size="lg" label="Overall" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {scoreRows.map(({ key, label, icon: Icon }) => {
          const v = specs.scores[key];
          const t = scoreTier(v);
          return (
            <div key={key} className="rounded-2xl border bg-background/60 p-3 flex flex-col items-center gap-2">
              <Icon className="w-5 h-5" style={{ color: t.color }} />
              <ScoreBadge value={v} size="md" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-center">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="rounded-xl border p-2.5 flex items-center gap-2">
          <CATEGORY_ICONS.bedroom className="w-4 h-4 text-primary" />
          <span><b>{specs.bedrooms}</b> bedroom{specs.bedrooms === 1 ? "" : "s"}</span>
        </div>
        <div className="rounded-xl border p-2.5 flex items-center gap-2">
          <CATEGORY_ICONS.toilet className="w-4 h-4 text-primary" />
          <span><b>{specs.toilets}</b> toilet{specs.toilets === 1 ? "" : "s"}</span>
        </div>
        <div className={cn("rounded-xl border p-2.5 flex items-center gap-2", specs.water_heater && "bg-primary/10 border-primary/40")}>
          <CATEGORY_ICONS.water_heater className="w-4 h-4 text-rose-500" />
          <span>{specs.water_heater ? "Water heater" : "No heater"}</span>
        </div>
        <div className={cn("rounded-xl border p-2.5 flex items-center gap-2", specs.kitchen && "bg-primary/10 border-primary/40")}>
          <CATEGORY_ICONS.kitchen className="w-4 h-4 text-amber-500" />
          <span>{specs.kitchen ? "Kitchen" : "No kitchen"}</span>
        </div>
        <div className={cn("rounded-xl border p-2.5 flex items-center gap-2", specs.ac && "bg-primary/10 border-primary/40")}>
          <CATEGORY_ICONS.ac className="w-4 h-4 text-sky-500" />
          <span>{specs.ac ? "AC" : "No AC"}</span>
        </div>
      </div>

      {specs.features.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Features</p>
          <div className="flex flex-wrap gap-2">
            {specs.features.map((k) => {
              const f = FEATURE_TOGGLES.find((x) => x.key === k);
              if (!f) return null;
              const Icon = f.icon;
              return (
                <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold">
                  <Icon className="w-3.5 h-3.5 text-primary" /> {f.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {specs.about && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">About this place</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{specs.about}</p>
        </div>
      )}

      {(specs.address || specs.map_url) && (
        <div className="rounded-2xl border bg-background/60 p-3 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" /> Location
          </p>
          {specs.address && <p className="text-sm">{specs.address}</p>}
          {specs.map_url && (
            <a
              href={specs.map_url}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
                <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
              </svg>
              Open in Google Maps <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
