import { createServerFn } from "@tanstack/react-start";

/**
 * Public, crawlable content readers used by route loaders so that market,
 * product, ticket and book pages ship real text + images inside the
 * server-rendered HTML (Google, Bing and AI crawlers don't execute JS).
 *
 * These run on the server with the service client because the browser
 * `anon` role has no SELECT grant on some of these tables — a loader using
 * the browser client fails with "permission denied" during SSR and the page
 * degrades to a "Loading…" shell.
 */

export const listMarketPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("market_listings")
    .select("*")
    .neq("listing_kind" as any, "advert")
    .eq("is_sold", false)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as any[];
});

export const listProductsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("market_listings")
    .select("*")
    .eq("listing_kind" as any, "products")
    .eq("is_sold", false)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []) as any[];
});

export const getListingPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("market_listings")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return (row as any) ?? null;
  });

export const listTicketsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tickets")
    .select("*")
    .eq("is_sold", false)
    .order("created_at", { ascending: false })
    .limit(60);
  return (data ?? []) as any[];
});

export const getTicketPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("tickets")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return (row as any) ?? null;
  });

export const getBookPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("library_books")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return (row as any) ?? null;
  });

export const listNewsPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("news_articles")
    .select("id, title, slug, summary, image_url, published_at, source_urls")
    .eq("category", "ebsu")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(60);
  return (data ?? []) as any[];
});

export const getNewsPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("news_articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return (row as any) ?? null;
  });
