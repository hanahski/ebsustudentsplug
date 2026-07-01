/* eslint-disable */
// Video cache Service Worker.
// Caches feed video responses so scrolling back doesn't re-download,
// and the browser can seek without re-streaming. LRU-capped.

const VIDEO_CACHE = "sp-video-cache-v1";
const MAX_ENTRIES = 24;             // keep last ~24 unique videos
const MAX_BYTES = 200 * 1024 * 1024; // ~200MB soft cap

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VIDEO_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isVideoRequest(request) {
  if (request.destination === "video") return true;
  const url = new URL(request.url);
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url.pathname);
}

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  const toDelete = keys.length - MAX_ENTRIES;
  for (let i = 0; i < toDelete; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (!isVideoRequest(req)) return;

  // Range requests: try cache; if we have full response, synthesize range.
  event.respondWith((async () => {
    const cache = await caches.open(VIDEO_CACHE);
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const cached = await cache.match(req.url, { ignoreVary: true });
      if (cached) {
        const buf = await cached.clone().arrayBuffer();
        const size = buf.byteLength;
        const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
        if (match) {
          const start = Number(match[1]);
          const end = match[2] ? Number(match[2]) : size - 1;
          const slice = buf.slice(start, end + 1);
          return new Response(slice, {
            status: 206,
            statusText: "Partial Content",
            headers: {
              "Content-Type": cached.headers.get("Content-Type") || "video/mp4",
              "Content-Length": String(slice.byteLength),
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Accept-Ranges": "bytes",
            },
          });
        }
      }
      // Fall through: network, don't cache range responses.
      return fetch(req);
    }

    // Full-body GET: cache-first.
    const cached = await cache.match(req.url, { ignoreVary: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.status === 200) {
        cache.put(req.url, res.clone()).then(() => trimCache(cache)).catch(() => {});
      }
      return res;
    } catch (err) {
      // Offline fallback: 504.
      return new Response("Video unavailable offline", { status: 504 });
    }
  })());
});

// Allow the app to explicitly prefetch upcoming videos.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "prefetch-video" && typeof data.url === "string") {
    caches.open(VIDEO_CACHE).then(async (cache) => {
      const exists = await cache.match(data.url, { ignoreVary: true });
      if (exists) return;
      try {
        const res = await fetch(data.url, { credentials: "omit" });
        if (res.ok && res.status === 200) {
          await cache.put(data.url, res.clone());
          await trimCache(cache);
        }
      } catch {}
    });
  }
});
