import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const catalogInput = z.object({
  category: z.enum(["all", "novel", "book", "comics", "poetry"]).default("all"),
  query: z.string().trim().max(100).default(""),
  // New source/tag filters: pdf = anything with a downloadable PDF (openstax),
  // free = price_credits === 0, ebsu = community-written (source=user).
  tag: z.enum(["all", "pdf", "free", "ebsu"]).default("all"),
  limit: z.number().int().min(1).max(120).default(120),
});

export const getLibraryBooks = createServerFn({ method: "GET" })
  .inputValidator((input) => catalogInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("library_books")
      .select("id,title,author,cover_url,category,price_credits,created_at,source,download_url")
      .in("source", ["user", "freebookcentre", "openstax"])
      .not("title", "is", null)
      .neq("title", "")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.category !== "all") query = query.eq("category", data.category);
    if (data.tag === "pdf") query = query.eq("source", "openstax");
    else if (data.tag === "free") query = query.eq("price_credits", 0);
    else if (data.tag === "ebsu") query = query.eq("source", "user");
    if (data.query) {
      const like = `%${data.query.replace(/[%,]/g, " ")}%`;
      query = query.or(`title.ilike.${like},author.ilike.${like}`);
    }

    const { data: books, error } = await query;
    if (error) throw new Error("Could not load the book catalog");
    return books ?? [];
  });
