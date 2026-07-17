// IndexNow ping endpoint — instantly notifies Bing, Yandex, Seznam, Naver
// when content changes. Also pings Google via a sitemap re-fetch hint.
//
// Usage: POST /api/public/hooks/indexnow  { "urls": ["https://ebsustudentsplug.fun/news/foo", ...] }
// Or:    GET  /api/public/hooks/indexnow?url=https://ebsustudentsplug.fun/news/foo
//
// Key file lives at /public/9f995b36a649d0f0f74d0f707110bb05.txt so IndexNow
// can verify ownership.
import { createFileRoute } from "@tanstack/react-router";

const HOST = "ebsustudentsplug.fun";
const KEY = "9f995b36a649d0f0f74d0f707110bb05";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

async function ping(urls: string[]) {
  const clean = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.startsWith(`https://${HOST}/`))));
  if (clean.length === 0) return { ok: false, reason: "no valid urls" };

  const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: clean };
  const results: Record<string, number> = {};
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
  // Nudge Google to re-crawl the sitemap.
  try {
    await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`https://${HOST}/sitemap.xml`)}`);
  } catch {}
  return { ok: true, submitted: clean, results };
}

export const Route = createFileRoute("/api/public/hooks/indexnow")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const urls = u.searchParams.getAll("url");
        const result = await ping(urls);
        return Response.json(result);
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const urls: string[] = Array.isArray(body?.urls) ? body.urls : [];
        const result = await ping(urls);
        return Response.json(result);
      },
    },
  },
});
