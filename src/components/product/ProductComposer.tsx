import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type ProductSpecs, type ProductCategory, type ConditionTier,
  CATEGORY_META, CONDITION_LABELS, CONDITION_COLORS, FIELD_ICONS,
  ACCESSORY_OPTIONS, ALLERGEN_OPTIONS,
  FASHION_ITEM_TYPES, BEAUTY_TYPES, FOOD_TYPES, SERVICE_TYPES,
  defaultSpecsFor,
} from "@/lib/product-specs";
import { Plus, X, Info } from "lucide-react";

/** Small helper controls */
function Row({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 | 3 }) {
  const g = cols === 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "";
  return <div className={cn("grid gap-3", g)}>{children}</div>;
}

function Field({
  label, icon: Icon, hint, children,
}: { label: string; icon?: any; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-primary" />} {label}
      </Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({
  label, icon: Icon, checked, onChange,
}: { label: string; icon?: any; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={cn(
      "rounded-2xl border p-3 flex items-center gap-3 cursor-pointer transition select-none",
      checked ? "bg-primary/10 border-primary/40" : "bg-muted/20 hover:bg-muted/40",
    )}>
      {Icon && <Icon className={cn("w-4 h-4", checked ? "text-primary" : "text-muted-foreground")} />}
      <span className="text-sm font-semibold flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function ChipPicker({
  label, options, selected, onToggle,
}: {
  label: string; options: string[]; selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold">{label} ({selected.length}/{options.length})</Label>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              type="button" key={o}
              onClick={() => onToggle(o)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-semibold border transition",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 border-border hover:bg-muted",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConditionPills({
  value, onChange,
}: { value: ConditionTier; onChange: (v: ConditionTier) => void }) {
  const tiers = Object.keys(CONDITION_LABELS) as ConditionTier[];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tiers.map((t) => {
        const active = value === t;
        const c = CONDITION_COLORS[t];
        return (
          <button
            key={t} type="button" onClick={() => onChange(t)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-bold border transition",
              active ? "shadow-sm" : "opacity-60 hover:opacity-100",
            )}
            style={{
              color: active ? "#fff" : c,
              background: active ? c : "transparent",
              borderColor: c,
              boxShadow: active ? `0 0 12px ${c}66` : "none",
            }}
          >
            {CONDITION_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

function TagsInput({
  tags, onChange, placeholder = "Add a tag & press Enter",
}: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) {
  return (
    <div className="rounded-2xl border bg-muted/20 p-2 flex flex-wrap gap-1.5 items-center">
      {tags.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text" placeholder={placeholder}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm px-1 py-0.5"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const v = (e.target as HTMLInputElement).value.trim().replace(/,$/, "");
            if (v && !tags.includes(v)) onChange([...tags, v]);
            (e.target as HTMLInputElement).value = "";
          }
        }}
      />
    </div>
  );
}

/** ------------------ Main composer ------------------ */

export function ProductComposer({
  category, value, onChange,
}: {
  category: ProductCategory;
  value: ProductSpecs;
  onChange: (v: ProductSpecs) => void;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  // Reset when the composer's kind doesn't match the requested category.
  if (value.kind !== category) {
    const fresh = defaultSpecsFor(category);
    // Preserve free-form notes & tags across category changes.
    fresh.notes = value.notes ?? "";
    fresh.tags = value.tags ?? [];
    onChange(fresh);
    return null;
  }

  const patch = <K extends keyof ProductSpecs>(k: K, v: any) =>
    onChange({ ...value, [k]: v } as ProductSpecs);

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}40` }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            {meta.label}
          </div>
          <h3 className="mt-1 font-display font-bold text-base sm:text-lg leading-tight truncate">Product details</h3>
          <p className="text-[11px] text-muted-foreground">The right specs make listings sell faster.</p>
        </div>
      </div>

      {category === "electronics" && <ElectronicsFields value={value as any} patch={patch} />}
      {category === "fashion"     && <FashionFields    value={value as any} patch={patch} />}
      {category === "beauty"      && <BeautyFields     value={value as any} patch={patch} />}
      {category === "food"        && <FoodFields       value={value as any} patch={patch} />}
      {category === "services"    && <ServicesFields   value={value as any} patch={patch} />}
      {category === "other"       && <OtherFields      value={value as any} patch={patch} />}

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-primary" /> Anything else buyers should know?
        </Label>
        <Textarea
          rows={3}
          value={value.notes}
          onChange={(e) => patch("notes", e.target.value)}
          placeholder="Extra notes, quirks, why you're selling — optional."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-semibold">Search tags</Label>
        <TagsInput tags={value.tags} onChange={(t) => patch("tags", t)} />
        <p className="text-[10px] text-muted-foreground">
          Short keywords help buyers find your listing (e.g. "iphone 12", "size 42").
        </p>
      </div>
    </div>
  );
}

/** ------------------ Per-category field sets ------------------ */

function ElectronicsFields({ value, patch }: { value: any; patch: any }) {
  const toggleAcc = (a: string) => {
    const has = value.accessories.includes(a);
    patch("accessories", has ? value.accessories.filter((x: string) => x !== a) : [...value.accessories, a]);
  };
  return (
    <div className="space-y-4">
      <Row>
        <Field label="Brand" icon={FIELD_ICONS.brand}>
          <Input value={value.brand} onChange={(e) => patch("brand", e.target.value)} placeholder="e.g. Apple, HP" />
        </Field>
        <Field label="Model" icon={FIELD_ICONS.model}>
          <Input value={value.model} onChange={(e) => patch("model", e.target.value)} placeholder="e.g. iPhone 12, Pavilion 15" />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label="Storage" icon={FIELD_ICONS.storage}>
          <Input value={value.storage} onChange={(e) => patch("storage", e.target.value)} placeholder="128GB" />
        </Field>
        <Field label="RAM" icon={FIELD_ICONS.ram}>
          <Input value={value.ram} onChange={(e) => patch("ram", e.target.value)} placeholder="8GB" />
        </Field>
        <Field label="Battery health (%)" icon={FIELD_ICONS.battery} hint="0 if you don't know">
          <Input type="number" min={0} max={100} value={value.battery_health || ""} onChange={(e) => patch("battery_health", Number(e.target.value) || 0)} />
        </Field>
      </Row>
      <Row>
        <Field label="Warranty (months)" icon={FIELD_ICONS.warranty}>
          <Input type="number" min={0} value={value.warranty_months || ""} onChange={(e) => patch("warranty_months", Number(e.target.value) || 0)} placeholder="0" />
        </Field>
        <Toggle label="Original box included" icon={FIELD_ICONS.box} checked={value.box_included} onChange={(v) => patch("box_included", v)} />
      </Row>
      <div>
        <Label className="text-xs font-semibold">Condition</Label>
        <div className="mt-1.5"><ConditionPills value={value.condition} onChange={(v) => patch("condition", v)} /></div>
      </div>
      <ChipPicker label="Accessories included" options={ACCESSORY_OPTIONS} selected={value.accessories} onToggle={toggleAcc} />
    </div>
  );
}

function FashionFields({ value, patch }: { value: any; patch: any }) {
  return (
    <div className="space-y-4">
      <Row cols={3}>
        <Field label="Item type">
          <Select value={value.item_type} onValueChange={(v) => patch("item_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FASHION_ITEM_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Gender">
          <Select value={value.gender} onValueChange={(v) => patch("gender", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["unisex", "men", "women", "kids"].map((g) => (
                <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Size" icon={FIELD_ICONS.size}>
          <Input value={value.size} onChange={(e) => patch("size", e.target.value)} placeholder="M / 42 / 34" />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label="Color" icon={FIELD_ICONS.color}>
          <Input value={value.color} onChange={(e) => patch("color", e.target.value)} placeholder="Black" />
        </Field>
        <Field label="Brand" icon={FIELD_ICONS.brand}>
          <Input value={value.brand} onChange={(e) => patch("brand", e.target.value)} placeholder="Nike, Zara" />
        </Field>
        <Field label="Material" icon={FIELD_ICONS.material}>
          <Input value={value.material} onChange={(e) => patch("material", e.target.value)} placeholder="Cotton, leather" />
        </Field>
      </Row>
      <div>
        <Label className="text-xs font-semibold">Condition</Label>
        <div className="mt-1.5"><ConditionPills value={value.condition} onChange={(v) => patch("condition", v)} /></div>
      </div>
    </div>
  );
}

function BeautyFields({ value, patch }: { value: any; patch: any }) {
  return (
    <div className="space-y-4">
      <Row cols={3}>
        <Field label="Product type">
          <Select value={value.product_type} onValueChange={(v) => patch("product_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BEAUTY_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Brand" icon={FIELD_ICONS.brand}>
          <Input value={value.brand} onChange={(e) => patch("brand", e.target.value)} placeholder="e.g. Nivea" />
        </Field>
        <Field label="Volume / size" icon={FIELD_ICONS.volume}>
          <Input value={value.volume} onChange={(e) => patch("volume", e.target.value)} placeholder="50ml / 100g" />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label="Best-before / expiry" icon={FIELD_ICONS.expiry}>
          <Input value={value.expiry} onChange={(e) => patch("expiry", e.target.value)} placeholder="2026-12" />
        </Field>
        <Field label="Skin / hair type">
          <Select value={value.skin_type} onValueChange={(v) => patch("skin_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "oily", "dry", "combination", "sensitive"].map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="space-y-2">
          <Toggle label="Sealed / unopened" icon={FIELD_ICONS.box} checked={value.sealed} onChange={(v) => patch("sealed", v)} />
        </div>
      </Row>
      <Toggle label="Cruelty-free / vegan" icon={FIELD_ICONS.cruelty} checked={value.cruelty_free} onChange={(v) => patch("cruelty_free", v)} />
    </div>
  );
}

function FoodFields({ value, patch }: { value: any; patch: any }) {
  const toggleAllergen = (a: string) => {
    const has = value.allergens.includes(a);
    patch("allergens", has ? value.allergens.filter((x: string) => x !== a) : [...value.allergens, a]);
  };
  return (
    <div className="space-y-4">
      <Row cols={3}>
        <Field label="Food type">
          <Select value={value.food_type} onValueChange={(v) => patch("food_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FOOD_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Portion / size" icon={FIELD_ICONS.portion}>
          <Input value={value.portion} onChange={(e) => patch("portion", e.target.value)} placeholder="Serves 1, 500ml" />
        </Field>
        <Field label="Prep / ready time" icon={FIELD_ICONS.prep}>
          <Input value={value.prep_time} onChange={(e) => patch("prep_time", e.target.value)} placeholder="15 min" />
        </Field>
      </Row>
      <Row cols={3}>
        <Field label="Delivery">
          <Select value={value.delivery} onValueChange={(v) => patch("delivery", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pickup">Pickup only</SelectItem>
              <SelectItem value="delivery">Delivery only</SelectItem>
              <SelectItem value="both">Pickup & delivery</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Toggle label="Halal" icon={FIELD_ICONS.halal} checked={value.halal} onChange={(v) => patch("halal", v)} />
        <Toggle label="Vegetarian" icon={FIELD_ICONS.veg} checked={value.vegetarian} onChange={(v) => patch("vegetarian", v)} />
      </Row>
      <ChipPicker label="Contains allergens" options={ALLERGEN_OPTIONS} selected={value.allergens} onToggle={toggleAllergen} />
    </div>
  );
}

function ServicesFields({ value, patch }: { value: any; patch: any }) {
  return (
    <div className="space-y-4">
      <Row cols={2}>
        <Field label="Service type">
          <Select value={value.service_type} onValueChange={(v) => patch("service_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Delivery mode" icon={FIELD_ICONS.mode}>
          <Select value={value.mode} onValueChange={(v) => patch("mode", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="onsite">On-site</SelectItem>
              <SelectItem value="remote">Remote / online</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </Row>
      <Row cols={3}>
        <Field label="Duration" icon={FIELD_ICONS.prep}>
          <Input value={value.duration} onChange={(e) => patch("duration", e.target.value)} placeholder="1 hour / per session" />
        </Field>
        <Field label="Availability" icon={FIELD_ICONS.availability}>
          <Input value={value.availability} onChange={(e) => patch("availability", e.target.value)} placeholder="Weekends, Mon-Fri 9-5" />
        </Field>
        <Field label="Experience (years)" icon={FIELD_ICONS.exp_years}>
          <Input type="number" min={0} value={value.experience_years || ""} onChange={(e) => patch("experience_years", Number(e.target.value) || 0)} placeholder="0" />
        </Field>
      </Row>
      <Field label="Portfolio / sample link" icon={FIELD_ICONS.portfolio} hint="Instagram, drive, website — anything that shows past work.">
        <Input value={value.portfolio_url} onChange={(e) => patch("portfolio_url", e.target.value)} placeholder="https://…" />
      </Field>
    </div>
  );
}

function OtherFields({ value, patch }: { value: any; patch: any }) {
  const add = () => patch("custom", [...value.custom, { key: "", value: "" }]);
  const upd = (i: number, k: "key" | "value", v: string) => {
    const next = value.custom.slice();
    next[i] = { ...next[i], [k]: v };
    patch("custom", next);
  };
  const del = (i: number) => patch("custom", value.custom.filter((_: any, j: number) => j !== i));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Add any spec that fits your item — like "Warranty · 6 months" or "Includes · manual".
      </p>
      <div className="space-y-2">
        {value.custom.map((row: any, i: number) => (
          <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2 items-center">
            <Input value={row.key} onChange={(e) => upd(i, "key", e.target.value)} placeholder="Label" />
            <Input value={row.value} onChange={(e) => upd(i, "value", e.target.value)} placeholder="Value" />
            <button type="button" onClick={() => del(i)} className="w-9 h-9 rounded-full border hover:bg-muted flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="rounded-full">
        <Plus className="w-4 h-4 mr-1" /> Add spec
      </Button>
    </div>
  );
}
