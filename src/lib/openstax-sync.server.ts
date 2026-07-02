import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Syncs OpenStax's freely-licensed textbook catalog into library_books.
// Each row is stored as source="openstax" so the app can:
//   - tag it as "PDF" (all OpenStax titles ship as downloadable PDFs)
//   - price it as free (price_credits = 0)
//   - skip the in-app reader and hand the user the raw PDF on purchase.
const CMS = "https://openstax.org/apps/cms/api/v2/pages/";
const FIELDS = "title,cover_url,high_resolution_pdf_url,low_resolution_pdf_url,description,book_state,promote_image";

type OpenStaxItem = {
  id: number;
  title: string;
  book_state?: string;
  description?: string | null;
  cover_url?: string | null;
  high_resolution_pdf_url?: string | null;
  low_resolution_pdf_url?: string | null;
  promote_image?: { meta?: { download_url?: string | null } } | null;
  meta?: { slug?: string; html_url?: string; first_published_at?: string | null };
};

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim() || null;
}

export async function syncOpenStax(limitPerPage = 100) {
  const errors: string[] = [];
  const collected = new Map<string, any>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${CMS}?type=books.Book&fields=${FIELDS}&limit=${limitPerPage}&offset=${offset}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch (e) {
      errors.push(`fetch ${offset}: ${(e as Error).message}`);
      break;
    }
    if (!res.ok) {
      errors.push(`http ${res.status} @ ${offset}`);
      break;
    }
    const json = (await res.json()) as { meta?: { total_count: number }; items: OpenStaxItem[] };
    total = json.meta?.total_count ?? json.items.length;
    for (const item of json.items) {
      if (item.book_state && item.book_state !== "live") continue;
      const pdf = item.high_resolution_pdf_url || item.low_resolution_pdf_url;
      if (!pdf) continue;
      const key = `openstax-${item.id}`;
      collected.set(key, {
        openlibrary_key: key,
        title: item.title.slice(0, 280),
        author: "OpenStax",
        cover_url: item.cover_url || item.promote_image?.meta?.download_url || null,
        category: "book",
        read_url: item.meta?.html_url ?? pdf,
        download_url: pdf,
        source_url: item.meta?.html_url ?? pdf,
        source: "openstax",
        description: stripHtml(item.description)?.slice(0, 800) ?? null,
        first_publish_year: item.meta?.first_published_at
          ? new Date(item.meta.first_published_at).getFullYear()
          : null,
        price_credits: 0,
      });
    }
    offset += json.items.length || limitPerPage;
    if (!json.items.length) break;
  }

  const rows = [...collected.values()];
  let rowsUpserted = 0;
  for (let i = 0; i < rows.length; i += 250) {
    const batch = rows.slice(i, i + 250);
    const { error } = await supabaseAdmin
      .from("library_books")
      .upsert(batch, { onConflict: "openlibrary_key" });
    if (error) throw new Error(error.message);
    rowsUpserted += batch.length;
  }

  return { booksFound: rows.length, rowsUpserted, errors };
}
