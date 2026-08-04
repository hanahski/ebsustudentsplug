// Streams an external PDF back to the browser with permissive CORS + range
// support so pdf.js can render it inside our in-app reader. External sources
// like assets.openstax.org, libretexts, gutenberg do NOT set
// Access-Control-Allow-Origin, so a direct fetch from the browser fails and
// the reader shows a blank/canvas-error. This route acts as a same-origin
// pass-through.
import { createFileRoute } from "@tanstack/react-router";

// Blocked network space (SSRF guard). Anything else public is allowed: our
// catalog links to hundreds of publisher domains (Open Textbook Library
// alone spans stephendavies.org, web.ung.edu, …), and a fixed allowlist made
// those books unreadable in the in-app reader.
const PRIVATE_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

// Only document payloads may be streamed back.
const DOC_TYPE =
  /(application\/(pdf|epub\+zip|epub|x-mobipocket-ebook|vnd\.amazon\.ebook|octet-stream|zip)|text\/plain)/i;

function isAllowed(u: URL) {
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (PRIVATE_HOST.test(u.hostname)) return false;
  return true;
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
  if (!isAllowed(target)) {
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
  const upstreamType = upstream.headers.get("content-type") ?? "";
  if (upstream.ok && upstreamType && !DOC_TYPE.test(upstreamType)) {
    return new Response("Not a document", { status: 415, headers: CORS });
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
