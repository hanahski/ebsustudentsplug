// Obooko serves its free files from a stable GET endpoint:
//   https://www.obooko.com/download-book/<slug>?format=pdf|epub
// No cookies, no CSRF token needed. The catalog crawl only stored the book
// landing page, which left every obooko row with no readable file — so
// unlocking one gave the user no "Read" option. These helpers resolve the
// real file URLs so obooko books behave like every other source.

const BASE = "https://www.obooko.com";
const UA = "StudentsPlug/1.0 (+library-sync)";

export function obookoSlug(pageUrl: string): string | null {
  try {
    const parts = new URL(pageUrl).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
  } catch {
    return null;
  }
}

export function obookoFileUrl(slug: string, format: "pdf" | "epub") {
  return `${BASE}/download-book/${slug}?format=${format}`;
}

async function fileExists(url: string, timeoutMs = 15_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": UA },
      redirect: "manual",
      signal: ctl.signal,
    });
    if (res.status !== 200) return false;
    const type = res.headers.get("content-type") ?? "";
    if (/text\/html/i.test(type)) return false;
    const len = Number(res.headers.get("content-length") ?? "0");
    return len > 2000;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Returns the download_formats map for an obooko book page URL. */
export async function resolveObookoFormats(
  pageUrl: string,
): Promise<Record<string, string>> {
  const slug = obookoSlug(pageUrl);
  if (!slug) return {};
  const formats: Record<string, string> = {};
  const pdf = obookoFileUrl(slug, "pdf");
  const epub = obookoFileUrl(slug, "epub");
  const [hasPdf, hasEpub] = await Promise.all([fileExists(pdf), fileExists(epub)]);
  if (hasPdf) formats.pdf = pdf;
  if (hasEpub) formats.epub = epub;
  return formats;
}

/** Resolve many book pages with bounded concurrency. */
export async function resolveObookoFormatsBatch<T extends { source_url: string }>(
  rows: T[],
  concurrency = 10,
): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  let i = 0;
  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (i < rows.length) {
      const row = rows[i++];
      out.set(row.source_url, await resolveObookoFormats(row.source_url));
    }
  });
  await Promise.all(workers);
  return out;
}
