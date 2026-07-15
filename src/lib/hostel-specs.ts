// Hostel/house rental spec model. Persisted inside `market_listings.description`
// as a hidden HTML comment so we don't need a schema migration.
//
// Marker format: `<!--HOSTEL::<base64 json>-->` appended to the end.

import {
  Zap, Droplets, Shield, Wifi, BedDouble, Bath, Flame, ChefHat, AirVent,
  Sofa, Fuel, Gauge, DoorClosed, Car, Camera, Landmark, School, Battery,
  Wifi as WifiIcon, ShowerHead, WashingMachine, Refrigerator, Tv, Warehouse,
  Trees, Sun, Ruler, KeyRound, Users, PawPrint, Cigarette, ShieldCheck,
  Sparkles, Clock, Package, LucideIcon,
} from "lucide-react";

export type HostelSpecs = {
  scores: { light: number; water: number; safety: number; network: number };
  bedrooms: number;
  toilets: number;
  water_heater: boolean;
  kitchen: boolean;
  ac: boolean;
  features: string[];        // keys from FEATURE_TOGGLES
  about: string;             // "About this place" long text
  map_url: string;           // Google Maps / geo link
  address: string;           // human-readable address
};

export const DEFAULT_SPECS: HostelSpecs = {
  scores: { light: 50, water: 50, safety: 50, network: 50 },
  bedrooms: 1,
  toilets: 1,
  water_heater: false,
  kitchen: false,
  ac: false,
  features: [],
  about: "",
  map_url: "",
  address: "",
};

/** Score utilities — the 1–100 quality gauge with 9 tiers. */
export type ScoreTier = {
  color: string;   // hex
  glow: string;    // rgba glow for shadow
  label: string;
  intensity: 0 | 1 | 2; // 0 dull, 1 medium, 2 glowing
};

export function scoreTier(n: number): ScoreTier {
  const v = Math.max(1, Math.min(100, Math.round(n || 0)));
  // Red band
  if (v <= 11) return { color: "#ef4444", glow: "rgba(239,68,68,0.85)", label: "Terrible", intensity: 2 };
  if (v <= 22) return { color: "#dc2626", glow: "rgba(220,38,38,0.55)", label: "Very bad", intensity: 1 };
  if (v <= 33) return { color: "#7f1d1d", glow: "rgba(127,29,29,0.35)", label: "Bad",       intensity: 0 };
  // Yellow band
  if (v <= 44) return { color: "#a16207", glow: "rgba(161,98,7,0.35)",  label: "Poor",      intensity: 0 };
  if (v <= 55) return { color: "#eab308", glow: "rgba(234,179,8,0.55)", label: "Okay",      intensity: 1 };
  if (v <= 66) return { color: "#facc15", glow: "rgba(250,204,21,0.85)", label: "Fair",     intensity: 2 };
  // Green band
  if (v <= 77) return { color: "#166534", glow: "rgba(22,101,52,0.35)", label: "Good",      intensity: 0 };
  if (v <= 88) return { color: "#16a34a", glow: "rgba(22,163,74,0.55)", label: "Great",     intensity: 1 };
  return         { color: "#22c55e", glow: "rgba(34,197,94,0.85)",      label: "Excellent", intensity: 2 };
}

export function overallScore(s: HostelSpecs["scores"]): number {
  return Math.round((s.light + s.water + s.safety + s.network) / 4);
}

/** 25 feature toggles for the composer / card chips. */
export const FEATURE_TOGGLES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "furnished",        label: "Furnished",           icon: Sofa },
  { key: "generator",        label: "Generator",           icon: Fuel },
  { key: "prepaid_meter",    label: "Prepaid meter",       icon: Gauge },
  { key: "self_contained",   label: "Self-contained",      icon: DoorClosed },
  { key: "parking",          label: "Parking space",       icon: Car },
  { key: "cctv",             label: "CCTV",                icon: Camera },
  { key: "gated_estate",     label: "Gated estate",        icon: Landmark },
  { key: "near_campus",      label: "Near campus",         icon: School },
  { key: "inverter_backup",  label: "Inverter backup",     icon: Battery },
  { key: "wifi_included",    label: "Wi-Fi included",      icon: WifiIcon },
  { key: "hot_shower",       label: "Hot shower",          icon: ShowerHead },
  { key: "washing_machine",  label: "Washing machine",     icon: WashingMachine },
  { key: "fridge",           label: "Fridge",              icon: Refrigerator },
  { key: "tv",               label: "TV",                  icon: Tv },
  { key: "wardrobe",         label: "Wardrobe",            icon: Warehouse },
  { key: "balcony",          label: "Balcony / garden",    icon: Trees },
  { key: "sunlight",         label: "Great sunlight",      icon: Sun },
  { key: "spacious",         label: "Spacious",            icon: Ruler },
  { key: "private_key",      label: "Private key",         icon: KeyRound },
  { key: "shared_apartment", label: "Shared apartment",    icon: Users },
  { key: "pets_allowed",     label: "Pets allowed",        icon: PawPrint },
  { key: "smoking_allowed",  label: "Smoking allowed",     icon: Cigarette },
  { key: "security_guard",   label: "Security guard",      icon: ShieldCheck },
  { key: "newly_painted",    label: "Newly painted",       icon: Sparkles },
  { key: "flexible_move_in", label: "Flexible move-in",    icon: Clock },
];

export const CATEGORY_ICONS = {
  light: Zap, water: Droplets, safety: Shield, network: Wifi,
  bedroom: BedDouble, toilet: Bath,
  water_heater: Flame, kitchen: ChefHat, ac: AirVent,
  other: Package,
} as const;

/** Marker embed helpers */
const MARK_RE = /<!--HOSTEL::([A-Za-z0-9+/=_-]+)-->/;

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

export function encodeHostelDescription(visible: string, specs: HostelSpecs): string {
  const clean = stripHostelMarker(visible).trim();
  const payload = b64encode(JSON.stringify(specs));
  return `${clean}\n\n<!--HOSTEL::${payload}-->`;
}

export function stripHostelMarker(desc: string | null | undefined): string {
  if (!desc) return "";
  return desc.replace(MARK_RE, "").trimEnd();
}

export function extractHostelSpecs(desc: string | null | undefined): HostelSpecs | null {
  if (!desc) return null;
  const m = desc.match(MARK_RE);
  if (!m) return null;
  try {
    const raw = JSON.parse(b64decode(m[1]));
    return { ...DEFAULT_SPECS, ...raw, scores: { ...DEFAULT_SPECS.scores, ...(raw.scores ?? {}) } };
  } catch { return null; }
}

export function isHostelListing(l: { category?: string | null; listing_kind?: string | null; description?: string | null }): boolean {
  return l?.category === "hostel" || !!extractHostelSpecs(l?.description);
}
