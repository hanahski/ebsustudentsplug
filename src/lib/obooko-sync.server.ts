// Obooko catalog indexer — link-out only. We store metadata + cover URL and
// send users to obooko.com to complete their free download there.
//
// Pricing note: the user asked for `price_credits = book rating`. Obooko does
// NOT expose per-book aggregate ratings publicly (the star widget on each
// book page is an interactive "Read and Rate" input, not a displayed average,
// and the `?rating=starsN` category filter has no observable effect). We use
// a flat 3.0-credit price ("3-star average") for every obooko book, which
// admins can adjust in the library editor later.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BASE = "https://www.obooko.com";
const UA = "StudentsPlug/1.0 (+library-sync)";
const DEFAULT_PRICE = 3.0;

const CATEGORIES: Array<{ slug: string; category: "novel" | "book" | "poetry" | "comics" }> = [
  { slug: "free-classic-books", category: "novel" },
  { slug: "free-fantasy-books", category: "novel" },
  { slug: "free-science-fiction-books", category: "novel" },
  { slug: "free-romance-books", category: "novel" },
  { slug: "free-historical-fiction-books", category: "novel" },
  { slug: "free-horror-supernatural-books", category: "novel" },
  { slug: "crime-thriller-mystery-books", category: "novel" },
  { slug: "free-books-for-teens", category: "novel" },
  { slug: "free-health-and-self-help-books", category: "book" },
];



type Row = {
  openlibrary_key: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  category: string;
  read_url: string;
  download_url: string | null;
  source_url: string;
  source: string;
  description: string | null;
  first_publish_year: number | null;
  price_credits: number;
  download_formats: Record<string, string>;
};

function cleanText(s: string) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugFromUrl(url: string) {
  return url.replace(/^https?:\/\/[^/]+\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 180);
}

async function fetchHtml(url: string, timeoutMs = 20_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// Extract tiles from a category listing.
function parseTiles(html: string): Array<{ href: string; title: string; author: string | null; cover: string | null }> {
  const out: Array<{ href: string; title: string; author: string | null; cover: string | null }> = [];
  const tileRegex = /library-book-tile[\s\S]*?<a\s+href="(https:\/\/www\.obooko\.com\/[^"]+)"[\s\S]*?<\/a>\s*<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = tileRegex.exec(html))) {
    const block = m[0];
    const href = m[1];
    if (!/\/(free|category|crime)/i.test(href)) continue;
    const imgMatch = block.match(/<img[^>]+src="(https:\/\/www\.obooko\.com\/images-cache\/[^"]+)"/i);
    const titleMatch = block.match(/book-row-book-title[^>]*>([^<]+)</i);
    const authorMatch = block.match(/book-row-book-author[^>]*>\s*(?:by\s*)?([^<]+)</i);
    const title = cleanText(titleMatch?.[1] ?? "");
    if (!title) continue;
    out.push({
      href,
      title,
      author: authorMatch ? cleanText(authorMatch[1]).replace(/^by\s+/i, "") : null,
      cover: imgMatch?.[1] ?? null,
    });
  }
  return out;
}

async function crawlCategory(
  slug: string,
  category: string,
  found: Map<string, Row>,
  maxPages: number,
) {
  for (let page = 1; page <= maxPages; page++) {
    const url = `${BASE}/category/${slug}?page=${page}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch {
      break;
    }
    const tiles = parseTiles(html);
    if (tiles.length === 0) break;
    let added = 0;
    for (const t of tiles) {
      const key = `obooko-${slugFromUrl(t.href)}`;
      if (found.has(key)) continue;
      added += 1;
      found.set(key, {
        openlibrary_key: key,
        title: t.title.slice(0, 280),
        author: t.author?.slice(0, 200) ?? null,
        cover_url: t.cover,
        category,
        read_url: t.href,
        download_url: null,
        source_url: t.href,
        source: "obooko",
        description: null,
        first_publish_year: null,
        price_credits: DEFAULT_PRICE,
        download_formats: {},
      });
    }
    // Stop once a page yields no new titles (we've circled back to the start).
    if (added === 0) break;
  }
}

export async function syncObooko(maxPagesPerCategory = 80) {
  const found = new Map<string, Row>();
  for (const cat of CATEGORIES) {
    await crawlCategory(cat.slug, cat.category, found, maxPagesPerCategory);
  }
  const rows = [...found.values()];
  let rowsUpserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabaseAdmin
      .from("library_books")
      .upsert(batch, { onConflict: "openlibrary_key" });
    if (error) throw new Error(error.message);
    rowsUpserted += batch.length;
  }
  return { source: "obooko", booksFound: rows.length, rowsUpserted };
}
