// Category-specific product spec model. Persisted inside
// `market_listings.description` as a hidden HTML comment (like hostel-specs)
// so we can ship rich structured data without a schema migration.
//
// Marker format: `<!--PRODUCT::<base64 json>-->` appended at the end.

import {
  Cpu, HardDrive, MemoryStick, Battery, ShieldCheck, Package as PkgIcon,
  Shirt, Ruler, Palette, Tag,
  Sparkles, Droplet, CalendarClock, ShieldAlert,
  Utensils, Flame, Clock, Truck, Leaf,
  Wrench, Video, Globe, Award,
  Plus, X as XIcon, LucideIcon,
} from "lucide-react";

export type ProductCategory =
  | "electronics" | "fashion" | "beauty" | "food" | "services" | "other";

export type ConditionTier =
  "brand_new" | "like_new" | "good" | "fair" | "worn";

export const CONDITION_LABELS: Record<ConditionTier, string> = {
  brand_new: "Brand new",
  like_new:  "Like new",
  good:      "Good",
  fair:      "Fair",
  worn:      "Worn",
};

export const CONDITION_COLORS: Record<ConditionTier, string> = {
  brand_new: "#22c55e",
  like_new:  "#16a34a",
  good:      "#eab308",
  fair:      "#f97316",
  worn:      "#ef4444",
};

/** Discriminated union — one shape per composer. */
export type ProductSpecs =
  | ElectronicsSpecs
  | FashionSpecs
  | BeautySpecs
  | FoodSpecs
  | ServicesSpecs
  | OtherSpecs;

export type BaseSpecs = { notes: string; tags: string[] };

export type ElectronicsSpecs = BaseSpecs & {
  kind: "electronics";
  brand: string;
  model: string;
  condition: ConditionTier;
  storage: string;         // "128GB"
  ram: string;             // "8GB"
  battery_health: number;  // 0-100 (0 = unknown)
  warranty_months: number; // 0 = none
  box_included: boolean;
  accessories: string[];   // from ACCESSORY_OPTIONS
};

export type FashionSpecs = BaseSpecs & {
  kind: "fashion";
  item_type: string;   // shirt / dress / shoe / bag / accessory / other
  gender: "unisex" | "men" | "women" | "kids";
  size: string;
  color: string;
  brand: string;
  material: string;
  condition: ConditionTier;
};

export type BeautySpecs = BaseSpecs & {
  kind: "beauty";
  product_type: string; // skincare / makeup / fragrance / haircare / tools
  brand: string;
  volume: string;       // "50ml"
  sealed: boolean;
  expiry: string;       // "YYYY-MM" or free text
  skin_type: string;    // oily / dry / combo / all
  cruelty_free: boolean;
};

export type FoodSpecs = BaseSpecs & {
  kind: "food";
  food_type: string;    // meal / snack / drink / pack / groceries
  portion: string;      // "Serves 1", "500ml", "1kg"
  prep_time: string;    // "15 min"
  delivery: "pickup" | "delivery" | "both";
  halal: boolean;
  vegetarian: boolean;
  allergens: string[];  // from ALLERGEN_OPTIONS
};

export type ServicesSpecs = BaseSpecs & {
  kind: "services";
  service_type: string;
  mode: "onsite" | "remote" | "both";
  duration: string;      // "1 hour", "per session"
  availability: string;  // "Weekends", "Mon-Fri 9-5"
  experience_years: number;
  portfolio_url: string;
};

export type OtherSpecs = BaseSpecs & {
  kind: "other";
  custom: { key: string; value: string }[];
};

/** ------------ Option catalogs ------------ */

export const ACCESSORY_OPTIONS = [
  "Charger", "Cable", "Earphones", "Case", "Screen protector",
  "Adapter", "Manual", "Receipt",
];

export const ALLERGEN_OPTIONS = [
  "Peanuts", "Tree nuts", "Milk", "Eggs", "Wheat/Gluten",
  "Soy", "Fish", "Shellfish", "Sesame",
];

export const FASHION_ITEM_TYPES = [
  "shirt", "t-shirt", "trouser", "jean", "dress", "gown", "skirt",
  "shoe", "sneaker", "bag", "cap", "accessory", "traditional", "other",
];

export const BEAUTY_TYPES = [
  "skincare", "makeup", "fragrance", "haircare", "bodycare", "tools", "other",
];

export const FOOD_TYPES = [
  "meal", "snack", "drink", "pack", "groceries", "dessert", "other",
];

export const SERVICE_TYPES = [
  "tutoring", "hairdressing", "makeup artist", "photography", "videography",
  "graphic design", "web design", "printing", "laundry", "cleaning",
  "delivery", "repair", "tailoring", "event planning", "other",
];

/** ------------ Defaults ------------ */

const BASE: BaseSpecs = { notes: "", tags: [] };

export const DEFAULTS: Record<ProductCategory, ProductSpecs> = {
  electronics: {
    ...BASE, kind: "electronics",
    brand: "", model: "", condition: "good",
    storage: "", ram: "", battery_health: 0,
    warranty_months: 0, box_included: false, accessories: [],
  },
  fashion: {
    ...BASE, kind: "fashion",
    item_type: "shirt", gender: "unisex", size: "",
    color: "", brand: "", material: "", condition: "good",
  },
  beauty: {
    ...BASE, kind: "beauty",
    product_type: "skincare", brand: "", volume: "",
    sealed: true, expiry: "", skin_type: "all", cruelty_free: false,
  },
  food: {
    ...BASE, kind: "food",
    food_type: "meal", portion: "", prep_time: "",
    delivery: "pickup", halal: false, vegetarian: false, allergens: [],
  },
  services: {
    ...BASE, kind: "services",
    service_type: "tutoring", mode: "both", duration: "",
    availability: "", experience_years: 0, portfolio_url: "",
  },
  other: {
    ...BASE, kind: "other",
    custom: [],
  },
};

export function defaultSpecsFor(cat: ProductCategory): ProductSpecs {
  const d = DEFAULTS[cat];
  // Deep clone so callers don't mutate the shared defaults.
  return JSON.parse(JSON.stringify(d));
}

/** ------------ Icons per category ------------ */

export const CATEGORY_META: Record<
  ProductCategory,
  { label: string; icon: LucideIcon; color: string }
> = {
  electronics: { label: "Electronics", icon: Cpu,      color: "#38bdf8" },
  fashion:     { label: "Fashion",     icon: Shirt,    color: "#f472b6" },
  beauty:      { label: "Beauty",      icon: Sparkles, color: "#c084fc" },
  food:        { label: "Food",        icon: Utensils, color: "#f97316" },
  services:    { label: "Services",    icon: Wrench,   color: "#22c55e" },
  other:       { label: "Other",       icon: PkgIcon,  color: "#94a3b8" },
};

export const FIELD_ICONS = {
  brand: Tag, model: Cpu, storage: HardDrive, ram: MemoryStick,
  battery: Battery, warranty: ShieldCheck, box: PkgIcon,
  size: Ruler, color: Palette, material: Shirt,
  volume: Droplet, expiry: CalendarClock, cruelty: ShieldAlert,
  portion: Utensils, prep: Clock, delivery: Truck, veg: Leaf, halal: Flame,
  mode: Globe, availability: Clock, exp_years: Award, portfolio: Video,
  add: Plus, remove: XIcon,
} as const;

/** ------------ Marker embed helpers ------------ */

const MARK_RE = /<!--PRODUCT::([A-Za-z0-9+/=_-]+)-->/;

function b64encode(s: string): string {
  if (typeof window === "undefined") return Buffer.from(s, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
  try {
    if (typeof window === "undefined") return Buffer.from(s, "base64").toString("utf8");
    return decodeURIComponent(escape(atob(s)));
  } catch { return ""; }
}

export function encodeProductDescription(visible: string, specs: ProductSpecs): string {
  const clean = stripProductMarker(visible).trim();
  const payload = b64encode(JSON.stringify(specs));
  return `${clean}\n\n<!--PRODUCT::${payload}-->`;
}

export function stripProductMarker(desc: string | null | undefined): string {
  if (!desc) return "";
  return desc.replace(MARK_RE, "").trimEnd();
}

export function extractProductSpecs(desc: string | null | undefined): ProductSpecs | null {
  if (!desc) return null;
  const m = desc.match(MARK_RE);
  if (!m) return null;
  try {
    const raw = JSON.parse(b64decode(m[1]));
    if (!raw?.kind) return null;
    const base = DEFAULTS[raw.kind as ProductCategory];
    if (!base) return null;
    return { ...base, ...raw };
  } catch { return null; }
}

/** Return true if a listing description carries a product-spec marker. */
export function hasProductSpecs(desc: string | null | undefined): boolean {
  return !!desc && MARK_RE.test(desc);
}
