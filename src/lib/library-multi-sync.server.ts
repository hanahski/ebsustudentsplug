import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Prices per user's spec.
export const SOURCE_PRICE: Record<string, number> = {
  openstax: 0.7,
  open_textbook_library: 0.9,
  gutenberg: 0.5,
  libretexts: 1.5,
  bccampus: 0.9,
};

export const FORMAT_LABELS: Record<string, string> = {
  pdf: "PDF",
  pages_zip: "Pages ZIP",
  lms: "LMS File",
  epub: "EPUB",
  kindle: "Kindle",
  blueprint: "Blueprint",
  html_zip: "HTML ZIP",
};

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

function stripHtml(v: string | null | undefined) {
  if (!v) return null;
  return v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

async function upsertBatch(rows: Row[]) {
  let n = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error } = await supabaseAdmin
      .from("library_books")
      .upsert(batch, { onConflict: "openlibrary_key" });
    if (error) throw new Error(error.message);
    n += batch.length;
  }
  return n;
}

// ---------- Project Gutenberg (public books via Gutendex) ----------
export async function syncGutenberg(pages = 4) {
  const rows: Row[] = [];
  for (let page = 1; page <= pages; page++) {
    const res = await fetch(
      `https://gutendex.com/books/?languages=en&mime_type=application%2Fepub%2Bzip&page=${page}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) break;
    const json = (await res.json()) as { results: any[] };
    for (const b of json.results ?? []) {
      const fmt = (b.formats ?? {}) as Record<string, string>;
      const pdf = fmt["application/pdf"];
      const epub = fmt["application/epub+zip"];
      const kindle = fmt["application/x-mobipocket-ebook"];
      const htmlZip = Object.entries(fmt).find(([k]) => k.startsWith("text/html") && k.includes("zip"))?.[1];
      const htmlOnline = fmt["text/html"];
      const cover = fmt["image/jpeg"];
      const formats: Record<string, string> = {};
      if (pdf) formats.pdf = pdf;
      if (epub) formats.epub = epub;
      if (kindle) formats.kindle = kindle;
      if (htmlZip) formats.html_zip = htmlZip;
      if (Object.keys(formats).length === 0) continue;
      const primary = pdf ?? epub ?? kindle ?? htmlOnline ?? Object.values(fmt)[0];
      const author = b.authors?.[0]?.name ?? null;
      rows.push({
        openlibrary_key: `gutenberg-${b.id}`,
        title: String(b.title).slice(0, 280),
        author,
        cover_url: cover ?? null,
        category: "novel",
        read_url: primary,
        download_url: pdf ?? epub ?? kindle ?? null,
        source_url: `https://www.gutenberg.org/ebooks/${b.id}`,
        source: "gutenberg",
        description: null,
        first_publish_year: null,
        price_credits: SOURCE_PRICE.gutenberg,
        download_formats: formats,
      });
    }
  }
  const rowsUpserted = await upsertBatch(rows);
  return { source: "gutenberg", booksFound: rows.length, rowsUpserted };
}

// ---------- Open Textbook Library ----------
export async function syncOpenTextbookLibrary(limit = 200) {
  const res = await fetch(
    `https://open.umn.edu/opentextbooks/textbooks.json?per_page=${limit}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`OTL HTTP ${res.status}`);
  const json = (await res.json()) as { data: any[] };
  const rows: Row[] = [];
  for (const t of json.data ?? []) {
    const formatsRaw = (t.formats ?? []) as Array<{ format?: string; url?: string }>;
    const formats: Record<string, string> = {};
    for (const f of formatsRaw) {
      const url = f.url;
      if (!url) continue;
      const fmt = String(f.format ?? "").toLowerCase();
      if (fmt.includes("pdf")) formats.pdf = url;
      else if (fmt.includes("epub")) formats.epub = url;
      else if (fmt.includes("mobi") || fmt.includes("kindle")) formats.kindle = url;
      else if (fmt.includes("html") && fmt.includes("zip")) formats.html_zip = url;
      else if (fmt.includes("pages") || fmt.includes("odt") || fmt.includes("docx")) formats.pages_zip = url;
      else if (fmt.includes("blueprint") || fmt.includes("common cartridge")) formats.lms = url;
    }
    if (!Object.keys(formats).length) continue;
    rows.push({
      openlibrary_key: `otl-${t.id}`,
      title: String(t.title ?? "").slice(0, 280),
      author: (t.contributors ?? []).map((c: any) => c.name).filter(Boolean).join(", ") || null,
      cover_url: t.image_url ?? null,
      category: "book",
      read_url: formats.pdf ?? formats.epub ?? t.detail_url ?? Object.values(formats)[0],
      download_url: formats.pdf ?? formats.epub ?? null,
      source_url: t.detail_url ?? "https://open.umn.edu/opentextbooks/",
      source: "open_textbook_library",
      description: stripHtml(t.description)?.slice(0, 800) ?? null,
      first_publish_year: t.copyright_year ?? null,
      price_credits: SOURCE_PRICE.open_textbook_library,
      download_formats: formats,
    });
  }
  const rowsUpserted = await upsertBatch(rows);
  return { source: "open_textbook_library", booksFound: rows.length, rowsUpserted };
}

// ---------- LibreTexts (LibreCommons catalog API) ----------
// Pulls the full LibreCommons catalog (3,000+ open textbooks) with real
// thumbnails, PDFs, LMS, and ZIP downloads. Paginated at 100 per page.
type LibreBook = {
  bookID: string;
  title: string;
  author?: string;
  affiliation?: string;
  library?: string;
  subject?: string;
  summary?: string;
  thumbnail?: string;
  links?: { online?: string; pdf?: string; zip?: string; files?: string; lms?: string };
};

export async function syncLibreTexts(maxPages = 40) {
  const rows: Row[] = [];
  const perPage = 100;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://commons.libretexts.org/api/v1/commons/catalog?limit=${perPage}&page=${page}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) break;
    const json = (await res.json()) as { books?: LibreBook[]; numTotal?: number };
    const books = json.books ?? [];
    if (books.length === 0) break;
    for (const b of books) {
      if (!b.bookID || !b.title) continue;
      const online = b.links?.online ?? `https://commons.libretexts.org/book/${b.bookID}`;
      const pdf = b.links?.pdf ?? null;
      const zip = b.links?.zip ?? null;
      const files = b.links?.files ?? null;
      const lms = b.links?.lms ?? null;
      const formats: Record<string, string> = {};
      if (pdf) formats.pdf = pdf;
      if (zip) formats.pages_zip = zip;
      if (files) formats.html_zip = files;
      if (lms) formats.lms = lms;
      const primary = pdf ?? online;
      rows.push({
        openlibrary_key: `libretexts-${b.bookID}`,
        title: b.title,
        author: b.author?.trim() || b.affiliation?.trim() || "LibreTexts",
        cover_url: b.thumbnail || null,
        category: "book",
        read_url: online,
        download_url: primary,
        source_url: online,
        source: "libretexts",
        description: stripHtml(b.summary) ?? `Open access ${b.subject || b.library || "textbook"} from LibreTexts.`,
        first_publish_year: null,
        price_credits: SOURCE_PRICE.libretexts,
        download_formats: formats,
      });
    }
    if (books.length < perPage) break;
    if (json.numTotal && page * perPage >= json.numTotal) break;
  }
  const rowsUpserted = await upsertBatch(rows);
  return { source: "libretexts", booksFound: rows.length, rowsUpserted };
}


// ---------- BCcampus (OPDS feed) ----------
export async function syncBCcampus(limit = 150) {
  const res = await fetch("https://collection.bccampus.ca/opds/", {
    headers: { Accept: "application/atom+xml, application/xml" },
  });
  if (!res.ok) throw new Error(`BCcampus HTTP ${res.status}`);
  const xml = await res.text();
  // Very light XML parsing — extract <entry> blocks.
  const entries = xml.split(/<entry\b/i).slice(1).map((s) => "<entry" + s.split("</entry>")[0] + "</entry>");
  const pick = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;
  };
  const links = (block: string) =>
    [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => {
      const attrs = Object.fromEntries(
        [...m[1].matchAll(/(\w+)=["']([^"']+)["']/g)].map((a) => [a[1].toLowerCase(), a[2]]),
      );
      return attrs;
    });

  const rows: Row[] = [];
  for (const block of entries.slice(0, limit)) {
    const title = pick(block, "title");
    if (!title) continue;
    const author = pick(block, "name") ?? pick(block, "author");
    const summary = pick(block, "summary") ?? pick(block, "content");
    const linkList = links(block);
    const formats: Record<string, string> = {};
    let cover: string | null = null;
    let sourceUrl = "https://collection.bccampus.ca/";
    for (const l of linkList) {
      const href = l.href;
      const type = (l.type ?? "").toLowerCase();
      const rel = (l.rel ?? "").toLowerCase();
      if (!href) continue;
      if (rel.includes("image") || type.startsWith("image/")) cover ??= href;
      else if (type.includes("pdf")) formats.pdf = href;
      else if (type.includes("epub")) formats.epub = href;
      else if (type.includes("mobi")) formats.kindle = href;
      else if (type.includes("zip") && href.toLowerCase().includes("html")) formats.html_zip = href;
      else if (type.includes("common-cartridge") || href.toLowerCase().includes("imscc")) formats.lms = href;
      else if (type.includes("pressbooks") || href.toLowerCase().includes("pages")) formats.pages_zip = href;
      else if (rel === "alternate" || rel === "self") sourceUrl = href;
    }
    if (!Object.keys(formats).length) continue;
    const key = `bccampus-${(title + (author ?? "")).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 120)}`;
    rows.push({
      openlibrary_key: key,
      title: title.slice(0, 280),
      author,
      cover_url: cover,
      category: "book",
      read_url: formats.pdf ?? formats.epub ?? sourceUrl,
      download_url: formats.pdf ?? formats.epub ?? null,
      source_url: sourceUrl,
      source: "bccampus",
      description: summary?.slice(0, 800) ?? null,
      first_publish_year: null,
      price_credits: SOURCE_PRICE.bccampus,
      download_formats: formats,
    });
  }
  const rowsUpserted = await upsertBatch(rows);
  return { source: "bccampus", booksFound: rows.length, rowsUpserted };
}
