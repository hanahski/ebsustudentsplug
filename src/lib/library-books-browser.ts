// Client-side library catalog reader. Runs directly against Supabase using
// the public anon key so the /books catalog works on ANY host (Vercel,
// Cloudflare, Netlify, etc.) — not just the Lovable runtime where the
// createServerFn version runs. `library_books` has an RLS policy
// `SELECT USING (true)` and `GRANT SELECT ... TO anon`, so this is safe.

import { supabase } from "@/integrations/supabase/client";

export type LibraryCatalogInput = {
  category?: "all" | "novel" | "book" | "textbook" | "comics" | "poetry";
  tag?: string;
  query?: string;
  limit?: number;
};

const ALL_SOURCES = [
  "user",
  "freebookcentre",
  "openstax",
  "gutenberg",
  "open_textbook_library",
  "libretexts",
  "bccampus",
];

const FORMAT_TAGS = new Set([
  "pdf",
  "epub",
  "kindle",
  "html_zip",
  "pages_zip",
  "lms",
  "blueprint",
]);

const COLS =
  "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url";

export async function fetchLibraryBooksClient(input: LibraryCatalogInput = {}) {
  const category = input.category ?? "all";
  const tag = input.tag ?? "all";
  const q = (input.query ?? "").trim();
  const limit = Math.min(Math.max(input.limit ?? 160, 1), 200);

  if (tag === "hard") return [] as any[];

  let query = supabase
    .from("library_books")
    .select(COLS)
    .not("title", "is", null)
    .neq("title", "")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category !== "all") query = query.eq("category", category);

  if (
    tag === "openstax" ||
    tag === "gutenberg" ||
    tag === "open_textbook_library" ||
    tag === "libretexts" ||
    tag === "bccampus"
  ) {
    query = query.eq("source", tag);
  } else if (tag === "ebsu" || tag === "studentsplug") {
    query = query.eq("source", "user");
  } else if (tag === "others") {
    query = query.in("source", ["freebookcentre"]);
  } else {
    query = query.in("source", ALL_SOURCES);
  }

  if (FORMAT_TAGS.has(tag)) {
    query = query.not(`download_formats->>${tag}`, "is", null);
  }

  if (tag === "free") query = query.eq("price_credits", 0);

  if (q) {
    const like = `%${q.replace(/[%,]/g, " ")}%`;
    query = query.or(`title.ilike.${like},author.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Could not load the book catalog");
  return data ?? [];
}
