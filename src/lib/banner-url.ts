import { supabase } from "@/integrations/supabase/client";

/**
 * The `banners` bucket is private (public buckets are blocked by the
 * workspace), so stored public URLs return 404. This resolves whatever is
 * stored in `banner_slides.image_url` into a usable signed URL.
 *
 * Handles three stored shapes:
 *  - a bare storage path (new uploads)               → "1781190748132-abc.png"
 *  - a legacy Supabase public URL (.../banners/...)  → extract path, sign it
 *  - an external http(s) URL                         → returned as-is
 *
 * Signed URLs are cached in memory AND localStorage, so repeat visits render
 * banners immediately instead of waiting on one sign round-trip per image.
 */
export function bannerStoragePath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const value = stored.trim();
  if (!value) return null;
  const marker = "/banners/";
  const idx = value.indexOf(marker);
  if (idx !== -1) return value.slice(idx + marker.length);
  // Bare path (no protocol) → treat as a storage key inside the bucket.
  if (!/^https?:\/\//i.test(value)) return value;
  return null; // external URL — not a storage object
}

const ONE_YEAR = 60 * 60 * 24 * 365;
const CACHE_PREFIX = "banner-url-cache:";
const mem = new Map<string, { url: string; exp: number }>();

function readCache(path: string): string | null {
  const hit = mem.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${path}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { url?: string; exp?: number };
    if (parsed.url && parsed.exp && parsed.exp > Date.now()) {
      mem.set(path, { url: parsed.url, exp: parsed.exp });
      return parsed.url;
    }
  } catch {}
  return null;
}

function writeCache(path: string, url: string) {
  // Cache for 30 days even though the signature lasts a year — keeps entries fresh.
  const entry = { url, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 };
  mem.set(path, entry);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${path}`, JSON.stringify(entry));
  } catch {}
}

export async function resolveBannerUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const path = bannerStoragePath(stored);
  if (!path) return stored.trim() || null; // external URL, use directly
  const cached = readCache(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("banners").createSignedUrl(path, ONE_YEAR);
  if (!data?.signedUrl) return null;
  writeCache(path, data.signedUrl);
  return data.signedUrl;
}

export async function resolveBannerUrls<T extends { image_url?: string | null }>(
  rows: T[],
): Promise<(T & { image_url: string | null })[]> {
  // Resolve everything we already have cached synchronously, then sign the
  // remaining paths in ONE batched request instead of N round-trips.
  const paths: string[] = [];
  const prepared = rows.map((r) => {
    const stored = r.image_url;
    const path = bannerStoragePath(stored);
    if (!path) return { row: r, url: stored?.trim() || null, path: null as string | null };
    const cached = readCache(path);
    if (cached) return { row: r, url: cached, path: null as string | null };
    paths.push(path);
    return { row: r, url: null as string | null, path };
  });

  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await supabase.storage.from("banners").createSignedUrls(paths, ONE_YEAR);
    for (const item of data ?? []) {
      const key = (item as any).path as string | null;
      if (key && item.signedUrl) {
        signed.set(key, item.signedUrl);
        writeCache(key, item.signedUrl);
      }
    }
  }

  return prepared.map((p) => ({
    ...p.row,
    image_url: p.path ? (signed.get(p.path) ?? null) : p.url,
  }));
}
