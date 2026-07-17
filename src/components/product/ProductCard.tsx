import {
  type ProductSpecs, CATEGORY_META, CONDITION_LABELS, CONDITION_COLORS,
} from "@/lib/product-specs";
import { cn } from "@/lib/utils";
import {
  Cpu, HardDrive, MemoryStick, Battery, ShieldCheck, Package as PkgIcon,
  Ruler, Palette, Tag, Droplet, CalendarClock, Truck, Utensils, Clock,
  Award, Globe, Video, Flame, Leaf, ShieldAlert,
} from "lucide-react";

function Chip({
  icon: Icon, children, tone = "default",
}: { icon?: any; children: React.ReactNode; tone?: "default" | "primary" | "success" | "warn" }) {
  const cls =
    tone === "primary" ? "bg-primary/15 text-primary border-primary/30" :
    tone === "success" ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
    tone === "warn"    ? "bg-amber-500/15 text-amber-500 border-amber-500/30" :
    "bg-muted text-foreground/80 border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold", cls)}>
      {Icon && <Icon className="w-3 h-3" />} {children}
    </span>
  );
}

function ConditionBadge({ v }: { v: keyof typeof CONDITION_LABELS }) {
  const c = CONDITION_COLORS[v];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c, background: `${c}18`, border: `1px solid ${c}55` }}
    >
      {CONDITION_LABELS[v]}
    </span>
  );
}

/** Compact strip shown on grid cards. */
export function ProductSpecStrip({ specs }: { specs: ProductSpecs }) {
  const meta = CATEGORY_META[specs.kind];
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <Chip icon={meta.icon} tone="primary">{meta.label}</Chip>

      {specs.kind === "electronics" && (
        <>
          {specs.brand && <Chip icon={Tag}>{specs.brand}</Chip>}
          {specs.storage && <Chip icon={HardDrive}>{specs.storage}</Chip>}
          {specs.ram && <Chip icon={MemoryStick}>{specs.ram} RAM</Chip>}
          <ConditionBadge v={specs.condition} />
        </>
      )}
      {specs.kind === "fashion" && (
        <>
          <Chip>{specs.item_type}</Chip>
          {specs.size && <Chip icon={Ruler}>Size {specs.size}</Chip>}
          {specs.color && <Chip icon={Palette}>{specs.color}</Chip>}
          <ConditionBadge v={specs.condition} />
        </>
      )}
      {specs.kind === "beauty" && (
        <>
          <Chip>{specs.product_type}</Chip>
          {specs.brand && <Chip icon={Tag}>{specs.brand}</Chip>}
          {specs.volume && <Chip icon={Droplet}>{specs.volume}</Chip>}
          {specs.sealed && <Chip tone="success" icon={PkgIcon}>Sealed</Chip>}
        </>
      )}
      {specs.kind === "food" && (
        <>
          <Chip icon={Utensils}>{specs.food_type}</Chip>
          {specs.portion && <Chip>{specs.portion}</Chip>}
          {specs.halal && <Chip tone="warn" icon={Flame}>Halal</Chip>}
          {specs.vegetarian && <Chip tone="success" icon={Leaf}>Veg</Chip>}
          {specs.delivery !== "pickup" && <Chip icon={Truck}>Delivery</Chip>}
        </>
      )}
      {specs.kind === "services" && (
        <>
          <Chip>{specs.service_type}</Chip>
          <Chip icon={Globe}>{specs.mode}</Chip>
          {specs.experience_years > 0 && <Chip icon={Award}>{specs.experience_years}y exp</Chip>}
        </>
      )}
      {specs.kind === "other" && specs.custom.slice(0, 3).map((c, i) =>
        c.key && c.value ? <Chip key={i}>{c.key}: {c.value}</Chip> : null,
      )}
    </div>
  );
}

/** Full detail block shown on the listing page. */
export function ProductDetailPanel({ specs }: { specs: ProductSpecs }) {
  const meta = CATEGORY_META[specs.kind];
  const Icon = meta.icon;

  const rows: { icon: any; label: string; value: React.ReactNode }[] = [];

  if (specs.kind === "electronics") {
    if (specs.brand)             rows.push({ icon: Tag,          label: "Brand",          value: specs.brand });
    if (specs.model)             rows.push({ icon: Cpu,          label: "Model",          value: specs.model });
    if (specs.storage)           rows.push({ icon: HardDrive,    label: "Storage",        value: specs.storage });
    if (specs.ram)               rows.push({ icon: MemoryStick,  label: "RAM",            value: specs.ram });
    if (specs.battery_health)    rows.push({ icon: Battery,      label: "Battery",        value: `${specs.battery_health}%` });
    if (specs.warranty_months)   rows.push({ icon: ShieldCheck,  label: "Warranty",       value: `${specs.warranty_months} mo` });
    rows.push({ icon: PkgIcon, label: "Original box", value: specs.box_included ? "Yes" : "No" });
    rows.push({ icon: PkgIcon, label: "Condition", value: <ConditionBadge v={specs.condition} /> });
  }
  if (specs.kind === "fashion") {
    rows.push({ icon: PkgIcon, label: "Item",     value: specs.item_type });
    rows.push({ icon: PkgIcon, label: "Gender",   value: specs.gender });
    if (specs.size)     rows.push({ icon: Ruler,    label: "Size",     value: specs.size });
    if (specs.color)    rows.push({ icon: Palette,  label: "Color",    value: specs.color });
    if (specs.brand)    rows.push({ icon: Tag,      label: "Brand",    value: specs.brand });
    if (specs.material) rows.push({ icon: PkgIcon,  label: "Material", value: specs.material });
    rows.push({ icon: PkgIcon, label: "Condition", value: <ConditionBadge v={specs.condition} /> });
  }
  if (specs.kind === "beauty") {
    rows.push({ icon: PkgIcon,        label: "Type",      value: specs.product_type });
    if (specs.brand)   rows.push({ icon: Tag,             label: "Brand",     value: specs.brand });
    if (specs.volume)  rows.push({ icon: Droplet,         label: "Size",      value: specs.volume });
    if (specs.expiry)  rows.push({ icon: CalendarClock,   label: "Expiry",    value: specs.expiry });
    rows.push({ icon: PkgIcon,        label: "Skin/Hair", value: specs.skin_type });
    rows.push({ icon: PkgIcon,        label: "Sealed",    value: specs.sealed ? "Yes" : "No" });
    rows.push({ icon: ShieldAlert,    label: "Cruelty-free", value: specs.cruelty_free ? "Yes" : "No" });
  }
  if (specs.kind === "food") {
    rows.push({ icon: Utensils, label: "Type",     value: specs.food_type });
    if (specs.portion)   rows.push({ icon: PkgIcon, label: "Portion",   value: specs.portion });
    if (specs.prep_time) rows.push({ icon: Clock,   label: "Ready in",  value: specs.prep_time });
    rows.push({ icon: Truck,     label: "Delivery", value: specs.delivery });
    rows.push({ icon: Flame,     label: "Halal",    value: specs.halal ? "Yes" : "No" });
    rows.push({ icon: Leaf,      label: "Veg",      value: specs.vegetarian ? "Yes" : "No" });
  }
  if (specs.kind === "services") {
    rows.push({ icon: PkgIcon, label: "Service",      value: specs.service_type });
    rows.push({ icon: Globe,   label: "Mode",         value: specs.mode });
    if (specs.duration)         rows.push({ icon: Clock,  label: "Duration",     value: specs.duration });
    if (specs.availability)     rows.push({ icon: Clock,  label: "Availability", value: specs.availability });
    if (specs.experience_years) rows.push({ icon: Award,  label: "Experience",   value: `${specs.experience_years} yrs` });
  }
  if (specs.kind === "other") {
    for (const c of specs.custom) {
      if (c.key || c.value) rows.push({ icon: PkgIcon, label: c.key || "Detail", value: c.value });
    }
  }

  return (
    <div className="mt-6 space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            {meta.label}
          </div>
          <h3 className="font-display font-bold text-base">Product details</h3>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {rows.map((r, i) => {
            const RowIcon = r.icon;
            return (
              <div key={i} className="rounded-xl border bg-background/60 p-2.5 flex items-start gap-2">
                <RowIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{r.label}</p>
                  <div className="font-semibold capitalize truncate">{r.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {specs.tags.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {specs.tags.map((t, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-[11px] font-semibold">
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {specs.kind === "services" && specs.portfolio_url && (
        <a
          href={specs.portfolio_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Video className="w-3.5 h-3.5" /> View portfolio
        </a>
      )}

      {specs.notes && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{specs.notes}</p>
        </div>
      )}
    </div>
  );
}
