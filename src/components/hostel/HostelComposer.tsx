import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FEATURE_TOGGLES,
  CATEGORY_ICONS,
  scoreTier,
  overallScore,
  type HostelSpecs,
} from "@/lib/hostel-specs";
import {
  Minus, Plus, MapPin, ExternalLink, Info,
} from "lucide-react";

function ScoreGauge({
  label, value, onChange, icon: Icon,
}: {
  label: string; value: number; onChange: (n: number) => void;
  icon: typeof CATEGORY_ICONS.light;
}) {
  const t = scoreTier(value);
  const shadow =
    t.intensity === 2 ? `0 0 22px ${t.glow}, 0 0 6px ${t.glow}` :
    t.intensity === 1 ? `0 0 12px ${t.glow}` : "none";
  return (
    <div className="rounded-2xl border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4" style={{ color: t.color }} />
          {label}
        </div>
        <div
          className="tabular-nums text-lg font-black rounded-full px-3 py-0.5 transition-all"
          style={{
            color: t.color,
            textShadow: t.intensity === 2 ? `0 0 10px ${t.glow}` : "none",
            boxShadow: shadow,
            border: `1px solid ${t.color}55`,
          }}
        >
          {value}
        </div>
      </div>
      <input
        type="range" min={1} max={100} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
        style={{
          background: `linear-gradient(to right, ${t.color} 0%, ${t.color} ${value}%, hsl(var(--muted)) ${value}%, hsl(var(--muted)) 100%)`,
          borderRadius: 9999,
          height: 6,
          WebkitAppearance: "none",
        }}
      />
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Poor</span>
        <span style={{ color: t.color }}>{t.label}</span>
        <span>Excellent</span>
      </div>
    </div>
  );
}

function Stepper({
  label, value, onChange, icon: Icon, min = 0, max = 20,
}: {
  label: string; value: number; onChange: (n: number) => void;
  icon: typeof CATEGORY_ICONS.bedroom; min?: number; max?: number;
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-3 flex items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold flex-1">
        <Icon className="w-4 h-4 text-primary" /> {label}
      </div>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-8 h-8 rounded-full border bg-background hover:bg-muted flex items-center justify-center"
        ><Minus className="w-4 h-4" /></button>
        <span className="w-8 text-center font-bold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-8 h-8 rounded-full border bg-background hover:bg-muted flex items-center justify-center"
        ><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function PresenceCard({
  label, checked, onChange, icon: Icon,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  icon: typeof CATEGORY_ICONS.kitchen;
}) {
  return (
    <label className={cn(
      "rounded-2xl border p-3 flex items-center gap-3 cursor-pointer transition select-none",
      checked ? "bg-primary/10 border-primary/40" : "bg-muted/20 hover:bg-muted/40",
    )}>
      <Icon className={cn("w-5 h-5", checked ? "text-primary" : "text-muted-foreground")} />
      <span className="text-sm font-semibold flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function HostelComposer({
  value, onChange,
}: {
  value: HostelSpecs; onChange: (v: HostelSpecs) => void;
}) {
  const set = <K extends keyof HostelSpecs>(k: K, v: HostelSpecs[K]) =>
    onChange({ ...value, [k]: v });
  const setScore = (k: keyof HostelSpecs["scores"], v: number) =>
    onChange({ ...value, scores: { ...value.scores, [k]: v } });
  const toggleFeature = (k: string) => {
    const has = value.features.includes(k);
    onChange({
      ...value,
      features: has ? value.features.filter((f) => f !== k) : [...value.features, k],
    });
  };

  const overall = useMemo(() => overallScore(value.scores), [value.scores]);
  const t = scoreTier(overall);

  return (
    <div className="space-y-5 rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-5 shadow-card">
      {/* Header + overall gauge */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-bold uppercase tracking-wider">
            Hostel / Apartment Details
          </div>
          <h3 className="mt-2 font-display font-bold text-lg">Rate the place honestly</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Students trust listings that spell out light, water, safety and network. Sliders auto-color from red to green.
          </p>
        </div>
        <div
          className="rounded-2xl px-4 py-3 border-2 text-center"
          style={{
            borderColor: t.color,
            boxShadow: t.intensity === 2 ? `0 0 24px ${t.glow}` : t.intensity === 1 ? `0 0 12px ${t.glow}` : "none",
            background: `linear-gradient(135deg, ${t.color}22, transparent)`,
          }}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
          <div
            className="text-3xl font-black tabular-nums"
            style={{ color: t.color, textShadow: t.intensity === 2 ? `0 0 12px ${t.glow}` : "none" }}
          >{overall}</div>
          <div className="text-[10px] font-semibold" style={{ color: t.color }}>{t.label}</div>
        </div>
      </div>

      {/* 1–100 gauges */}
      <div className="grid sm:grid-cols-2 gap-3">
        <ScoreGauge label="Light / Power"  value={value.scores.light}   onChange={(n) => setScore("light", n)}   icon={CATEGORY_ICONS.light} />
        <ScoreGauge label="Water supply"   value={value.scores.water}   onChange={(n) => setScore("water", n)}   icon={CATEGORY_ICONS.water} />
        <ScoreGauge label="Safety"         value={value.scores.safety}  onChange={(n) => setScore("safety", n)}  icon={CATEGORY_ICONS.safety} />
        <ScoreGauge label="Network signal" value={value.scores.network} onChange={(n) => setScore("network", n)} icon={CATEGORY_ICONS.network} />
      </div>

      {/* Steppers + presence */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Stepper label="Bedrooms" value={value.bedrooms} onChange={(n) => set("bedrooms", n)} icon={CATEGORY_ICONS.bedroom} />
        <Stepper label="Toilets"  value={value.toilets}  onChange={(n) => set("toilets", n)}  icon={CATEGORY_ICONS.toilet} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <PresenceCard label="Water heater" checked={value.water_heater} onChange={(v) => set("water_heater", v)} icon={CATEGORY_ICONS.water_heater} />
        <PresenceCard label="Kitchen"      checked={value.kitchen}      onChange={(v) => set("kitchen", v)}      icon={CATEGORY_ICONS.kitchen} />
        <PresenceCard label="Air conditioning" checked={value.ac}      onChange={(v) => set("ac", v)}          icon={CATEGORY_ICONS.ac} />
      </div>

      {/* Feature pills */}
      <div>
        <Label className="text-sm font-semibold">Extra features ({value.features.length}/{FEATURE_TOGGLES.length})</Label>
        <p className="text-[11px] text-muted-foreground mb-2">Tap all that apply — chips show on the listing card.</p>
        <div className="flex flex-wrap gap-2">
          {FEATURE_TOGGLES.map(({ key, label, icon: Icon }) => {
            const active = value.features.includes(key);
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggleFeature(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 border-border hover:bg-muted",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* About */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Info className="w-4 h-4 text-primary" /> About this place
        </Label>
        <Textarea
          rows={4}
          value={value.about}
          onChange={(e) => set("about", e.target.value)}
          placeholder="Describe the vibe — landlord rules, neighbours, distance to shuttle stop, past experience living here…"
        />
      </div>

      {/* Location */}
      <div className="space-y-2 rounded-2xl border bg-muted/20 p-3">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-primary" /> Location
        </Label>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">Address / area</Label>
            <Input
              value={value.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. Presco Junction, behind CAS gate"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Google Maps link</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
              <Input
                value={value.map_url}
                onChange={(e) => set("map_url", e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        {value.map_url && (
          <Button
            type="button" size="sm" variant="outline" asChild
            className="rounded-full text-xs"
          >
            <a href={value.map_url} target="_blank" rel="noreferrer">
              Preview map <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
