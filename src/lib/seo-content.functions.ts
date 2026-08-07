import { createServerFn } from "@tanstack/react-start";

/**
 * Public, crawlable content readers used by route loaders so that market,
 * product, ticket and book pages ship real text + images inside the
 * server-rendered HTML (Google, Bing and AI crawlers don't execute JS).
 *
 * These use the resilient public read client: service role when available,
 * publishable key otherwise. They never throw — a failed read degrades to
 * empty data so the page still renders (a throw would 500 the whole route).
 */

async function safeRead<T>(fn: (db: any) => Promise<T>, fallback: T): Promise<T> {
  try {
    const { getPublicReadClient } = await import("@/lib/supabase-read.server");
    const db = await getPublicReadClient();
    return await fn(db);
  } catch (error) {
    console.error("[seo-content] public read failed", error);
    return fallback;
  }
}

export const listMarketPublic = createServerFn({ method: "GET" }).handler(async () =>
  safeRead(async (db) => {
    const { data } = await db
      .from("market_listings")
      .select("*")
      .neq("listing_kind", "advert")
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as any[];
  }, [] as any[]),
);

export const listProductsPublic = createServerFn({ method: "GET" }).handler(async () =>
  safeRead(async (db) => {
    const { data } = await db
      .from("market_listings")
      .select("*")
      .eq("listing_kind", "products")
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .limit(30);
    return (data ?? []) as any[];
  }, [] as any[]),
);

export const getListingPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    safeRead(async (db) => {
      const { data: row } = await db.from("market_listings").select("*").eq("id", data.id).maybeSingle();
      return (row as any) ?? null;
    }, null as any),
  );

export const listTicketsPublic = createServerFn({ method: "GET" }).handler(async () =>
  safeRead(async (db) => {
    const { data } = await db
      .from("tickets")
      .select("*")
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []) as any[];
  }, [] as any[]),
);

export const getTicketPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    safeRead(async (db) => {
      const { data: row } = await db.from("tickets").select("*").eq("id", data.id).maybeSingle();
      return (row as any) ?? null;
    }, null as any),
  );

export const getBookPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) =>
    safeRead(async (db) => {
      const { data: row } = await db.from("library_books").select("*").eq("id", data.id).maybeSingle();
      return (row as any) ?? null;
    }, null as any),
  );

export const listNewsPublic = createServerFn({ method: "GET" }).handler(async () =>
  safeRead(async (db) => {
    const { data } = await db
      .from("news_articles")
      .select("id, title, slug, summary, image_url, published_at, source_urls")
      .eq("category", "ebsu")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60);
    return (data ?? []) as any[];
  }, [] as any[]),
);

export const getNewsPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) =>
    safeRead(async (db) => {
      const { data: row } = await db
        .from("news_articles")
        .select("*")
        .eq("slug", data.slug)
        .eq("status", "published")
        .maybeSingle();
      return (row as any) ?? null;
    }, null as any),
  );
