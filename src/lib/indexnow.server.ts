// Server-side, fire-and-forget IndexNow submission. Notifies Bing/Yandex etc.
// instantly and nudges Google to re-crawl the sitemap. Never throws — a failed
// ping must never break a publish.
const SITE = "https://ebsustudentsplug.fun";
const HOST = "ebsustudentsplug.fun";
const KEY = "9f995b36a649d0f0f74d0f707110bb05";

export function pingIndexNowServer(paths: string | string[]) {
  const urls = Array.from(
    new Set(
      (Array.isArray(paths) ? paths : [paths])
        .filter(Boolean)
        .map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`)),
    ),
  );
  if (urls.length === 0) return;

  const body = JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls });
  for (const endpoint of ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"]) {
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
      }).catch(() => {});
    } catch {
      /* noop */
    }
  }
  try {
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(`${SITE}/sitemap.xml`)}`).catch(() => {});
  } catch {
    /* noop */
  }
}
