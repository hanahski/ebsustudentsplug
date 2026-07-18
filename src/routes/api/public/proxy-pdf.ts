// Streams an external PDF back to the browser with permissive CORS + range
// support so pdf.js can render it inside our in-app reader. External sources
// like assets.openstax.org, libretexts, gutenberg do NOT set
// Access-Control-Allow-Origin, so a direct fetch from the browser fails and
// the reader shows a blank/canvas-error. This route acts as a same-origin
// pass-through.
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOSTS = [
  "assets.openstax.org",
  "openstax.org",
  "cnx.org",
  "batch.libretexts.org",
  "libretexts.org",
  "www.gutenberg.org",
  "gutenberg.org",
  "open.umn.edu",
  "www.freebookcentre.net",
  "bccampus.ca",
  "pressbooks.bccampus.ca",
  "open.bccampus.ca",
];

function isAllowed(u: URL) {
  return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, HEAD, OPTIONS",
  "access-control-allow-headers": "range, content-type",
  "access-control-expose-headers": "content-length, content-range, accept-ranges",
};

async function handle(request: Request) {
  const src = new URL(request.url).searchParams.get("url");
  if (!src) return new Response("Missing url", { status: 400, headers: CORS });
  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response("Bad url", { status: 400, headers: CORS });
  }
  if (target.protocol !== "https:" || !isAllowed(target)) {
    return new Response("Host not allowed", { status: 403, headers: CORS });
  }
  const forward: Record<string, string> = {
    "user-agent": "StudentsPlug/1.0 (+pdf-proxy)",
  };
  const range = request.headers.get("range");
  if (range) forward.range = range;
  const upstream = await fetch(target.toString(), {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: forward,
    redirect: "follow",
  });
  const headers = new Headers(CORS);
  const pass = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];
  for (const k of pass) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  if (!headers.get("content-type")) headers.set("content-type", "application/pdf");
  headers.set("cache-control", "public, max-age=86400");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const Route = createFileRoute("/api/public/proxy-pdf")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      HEAD: ({ request }) => handle(request),
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
    },
  },
});
