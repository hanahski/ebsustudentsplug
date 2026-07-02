import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const catalogInput = z.object({
  category: z.enum(["all", "novel", "book", "comics", "poetry", "textbook"]).default("all"),
  query: z.string().trim().max(100).default(""),
  // Combined source / format / copy filter.
  tag: z
    .enum([
      "all",
      // formats
      "pdf",
      "epub",
      "kindle",
      "html_zip",
      "pages_zip",
      "lms",
      "blueprint",
      // copy type
      "soft",
      "hard",
      // pricing / origin buckets
      "free",
      "ebsu",
      "studentsplug",
      "others",
      // specific sources
      "openstax",
      "gutenberg",
      "open_textbook_library",
      "libretexts",
      "bccampus",
    ])
    .default("all"),
  limit: z.number().int().min(1).max(200).default(120),
});

const ALL_SOURCES = [
  "user",
  "freebookcentre",
  "openstax",
  "gutenberg",
  "open_textbook_library",
  "libretexts",
  "bccampus",
];

const FORMAT_TAGS = new Set(["pdf", "epub", "kindle", "html_zip", "pages_zip", "lms", "blueprint"]);

export const getLibraryBooks = createServerFn({ method: "GET" })
  .inputValidator((input) => catalogInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cols =
      "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url";

    let query = supabaseAdmin
      .from("library_books")
      .select(cols)
      .not("title", "is", null)
      .neq("title", "")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    // Category (skip when the tag is "hard" — hard-copy lives in market_listings).
    if (data.category !== "all") query = query.eq("category", data.category);

    // Source scoping.
    if (
      data.tag === "openstax" ||
      data.tag === "gutenberg" ||
      data.tag === "open_textbook_library" ||
      data.tag === "libretexts" ||
      data.tag === "bccampus"
    ) {
      query = query.eq("source", data.tag);
    } else if (data.tag === "ebsu" || data.tag === "studentsplug") {
      query = query.eq("source", "user");
    } else if (data.tag === "others") {
      query = query.in("source", ["freebookcentre"]);
    } else {
      query = query.in("source", ALL_SOURCES);
    }

    // Format scoping (jsonb key present).
    if (FORMAT_TAGS.has(data.tag)) {
      query = query.not(`download_formats->>${data.tag}`, "is", null);
    }

    if (data.tag === "free") query = query.eq("price_credits", 0);
    if (data.tag === "soft") {
      // All library rows are soft/digital by definition — no extra filter.
    }
    if (data.tag === "hard") {
      // Hard copies aren't in library_books; return empty so the UI can suggest market.
      return [] as any[];
    }

    if (data.query) {
      const like = `%${data.query.replace(/[%,]/g, " ")}%`;
      query = query.or(`title.ilike.${like},author.ilike.${like}`);
    }

    const { data: books, error } = await query;
    if (error) throw new Error("Could not load the book catalog");
    return books ?? [];
  });

// Popular novels for the market feed. Samples from a wide candidate pool
// (novels/books with real covers) and returns a random 50 each call so the
// feed feels fresh on every visit.
export const getPopularNovels = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cols =
      "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url";

    // Candidate pool: novels + generic books, must have a cover and a title,
    // from established sources (skip empty/uncurated rows).
    const { data: pool, error } = await supabaseAdmin
      .from("library_books")
      .select(cols)
      .in("category", ["novel", "book"])
      .not("title", "is", null)
      .neq("title", "")
      .not("cover_url", "is", null)
      .neq("cover_url", "")
      .in("source", ALL_SOURCES)
      .limit(400);
    if (error) throw new Error("Could not load popular novels");

    const arr = [...(pool ?? [])];
    // Fisher–Yates shuffle for a uniform random sample each request.
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, data.limit);
  });

// --- Auto-sync: public, self-rate-limiting (only syncs sources with < 20 books) ---
export const ensureLibraryCatalog = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const targets: Array<{ source: string; run: () => Promise<any> }> = [];
  const multi = await import("@/lib/library-multi-sync.server");
  const { syncOpenStax } = await import("@/lib/openstax-sync.server");
  const jobs: Record<string, () => Promise<any>> = {
    openstax: syncOpenStax,
    gutenberg: multi.syncGutenberg,
    open_textbook_library: multi.syncOpenTextbookLibrary,
    libretexts: multi.syncLibreTexts,
    bccampus: multi.syncBCcampus,
  };
  for (const [src, run] of Object.entries(jobs)) {
    const { count } = await supabaseAdmin
      .from("library_books")
      .select("id", { count: "exact", head: true })
      .eq("source", src);
    if ((count ?? 0) < 20) targets.push({ source: src, run });
  }
  const results: any[] = [];
  for (const t of targets) {
    try {
      results.push({ source: t.source, ...(await t.run()) });
    } catch (e) {
      results.push({ source: t.source, error: (e as Error).message });
    }
  }
  return { ran: targets.length, results };
});
