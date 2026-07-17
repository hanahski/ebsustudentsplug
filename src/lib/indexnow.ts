// Fire-and-forget IndexNow ping. Notifies Bing/Yandex instantly and nudges
// Google to re-crawl the sitemap. Safe to call from any client code — errors
// are swallowed so a failed ping never blocks the user flow.
const SITE = "https://ebsustudentsplug.fun";

export function pingIndexNow(paths: string | string[]) {
  const arr = (Array.isArray(paths) ? paths : [paths])
    .filter(Boolean)
    .map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`));
  if (arr.length === 0) return;
  try {
    fetch(`${SITE}/api/public/hooks/indexnow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: arr }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
