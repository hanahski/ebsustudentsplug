import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const catalogInput = z.object({
  category: z.enum(["all", "novel", "book", "comics", "poetry"]).default("all"),
  query: z.string().trim().max(100).default(""),
  // Source / tag filter.
  tag: z
    .enum([
      "all",
      "pdf",
      "epub",
      "free",
      "ebsu",
      "openstax",
      "gutenberg",
      "open_textbook_library",
      "libretexts",
      "bccampus",
    ])
    .default("all"),
  limit: z.number().int().min(1).max(200).default(160),
});

const SOURCES = [
  "user",
  "freebookcentre",
  "openstax",
  "gutenberg",
  "open_textbook_library",
  "libretexts",
  "bccampus",
];

export const getLibraryBooks = createServerFn({ method: "GET" })
  .inputValidator((input) => catalogInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("library_books")
      .select(
        "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url",
      )
      .in("source", SOURCES)
      .not("title", "is", null)
      .neq("title", "")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.category !== "all") query = query.eq("category", data.category);

    // Source-specific tags.
    if (
      data.tag === "openstax" ||
      data.tag === "gutenberg" ||
      data.tag === "open_textbook_library" ||
      data.tag === "libretexts" ||
      data.tag === "bccampus"
    ) {
      query = query.eq("source", data.tag);
    } else if (data.tag === "ebsu") query = query.eq("source", "user");
    else if (data.tag === "free") query = query.eq("price_credits", 0);
    else if (data.tag === "pdf") query = query.contains("download_formats", { pdf: null } as any);
    // "epub" filter falls through — contains with jsonb below.
    if (data.tag === "pdf")
      query = supabaseAdmin
        .from("library_books")
        .select(
          "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url",
        )
        .in("source", SOURCES)
        .not("title", "is", null)
        .neq("title", "")
        .not("download_formats->>pdf", "is", null)
        .order("created_at", { ascending: false })
        .limit(data.limit);
    if (data.tag === "epub")
      query = supabaseAdmin
        .from("library_books")
        .select(
          "id,title,author,cover_url,category,price_credits,created_at,source,download_url,download_formats,source_url",
        )
        .in("source", SOURCES)
        .not("title", "is", null)
        .neq("title", "")
        .not("download_formats->>epub", "is", null)
        .order("created_at", { ascending: false })
        .limit(data.limit);

    if (data.category !== "all" && (data.tag === "pdf" || data.tag === "epub")) {
      query = query.eq("category", data.category);
    }

    if (data.query) {
      const like = `%${data.query.replace(/[%,]/g, " ")}%`;
      query = query.or(`title.ilike.${like},author.ilike.${like}`);
    }

    const { data: books, error } = await query;
    if (error) throw new Error("Could not load the book catalog");
    return books ?? [];
  });
