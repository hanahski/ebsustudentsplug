// Automatic re-indexing sweep. Collects every URL whose content changed
// recently (news, blog, market listings, tickets, books) plus the core hub
// pages, then submits them to IndexNow (Bing, Yandex, Seznam, Naver) and
// nudges Google to re-fetch the sitemap.
//
// Call it from a scheduler (pg_cron / uptime pinger) once or twice a day:
//   GET /api/public/hooks/auto-indexnow?hours=24
import { createFileRoute } from "@tanstack/react-router";

const HOST = "ebsustudentsplug.fun";
const SITE = `https://${HOST}`;
const KEY = "9f995b36a649d0f0f74d0f707110bb05";

async function submit(urls: string[]) {
  const clean = Array.from(new Set(urls)).filter((u) => u.startsWith(`${SITE}/`));
  if (clean.length === 0) return { submitted: 0, results: {} as Record<string, number> };
  const results: Record<string, number> = {};
  // IndexNow accepts up to 10k URLs per request; chunk to stay well under.
  for (let i = 0; i < clean.length; i += 500) {
    const chunk = clean.slice(i, i + 500);
    const body = { host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: chunk };
    await Promise.all(
      ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"].map(async (endpoint) => {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(body),
          });
          results[endpoint] = res.status;
        } catch {
          results[endpoint] = 0;
        }
      }),
    );
  }
  try {
    await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${SITE}/sitemap.xml`)}`);
  } catch {
    /* best effort */
  }
  return { submitted: clean.length, results };
}

async function sweep(hours: number) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const [news, blog, listings, tickets, books] = await Promise.all([
    supabaseAdmin
      .from("news_articles")
      .select("slug,published_at")
      .eq("status", "published")
      .gte("published_at", since),
    supabaseAdmin.from("blog_posts").select("slug,published_at").eq("published", true).gte("published_at", since),
    supabaseAdmin.from("market_listings").select("id,created_at").gte("created_at", since),
    supabaseAdmin.from("tickets").select("id,created_at").gte("created_at", since),
    supabaseAdmin.from("library_books").select("id,created_at").gte("created_at", since).limit(500),
  ]);

  const urls: string[] = [
    `${SITE}/`,
    `${SITE}/news`,
    `${SITE}/blog`,
    `${SITE}/market`,
    `${SITE}/products`,
    `${SITE}/tickets`,
    `${SITE}/books`,
    `${SITE}/school-biography`,
    `${SITE}/faculties`,
    `${SITE}/courses`,
  ];
  for (const r of (news.data ?? []) as any[]) if (r.slug) urls.push(`${SITE}/news/${r.slug}`);
  for (const r of (blog.data ?? []) as any[]) if (r.slug) urls.push(`${SITE}/blog/${r.slug}`);
  for (const r of (listings.data ?? []) as any[]) if (r.id) urls.push(`${SITE}/market/${r.id}`);
  for (const r of (tickets.data ?? []) as any[]) if (r.id) urls.push(`${SITE}/tickets/${r.id}`);
  for (const r of (books.data ?? []) as any[]) if (r.id) urls.push(`${SITE}/books/read/${r.id}`);

  return submit(urls);
}

export const Route = createFileRoute("/api/public/hooks/auto-indexnow")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const hours = Math.min(
          Math.max(Number(new URL(request.url).searchParams.get("hours") ?? 24) || 24, 1),
          24 * 30,
        );
        return Response.json({ ok: true, hours, ...(await sweep(hours)) });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as { hours?: number };
        const hours = Math.min(Math.max(Number(body?.hours ?? 24) || 24, 1), 24 * 30);
        return Response.json({ ok: true, hours, ...(await sweep(hours)) });
      },
    },
  },
});
