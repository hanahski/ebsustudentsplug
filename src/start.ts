import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const CANONICAL_DOMAIN = "ebsustudentsplug.fun";

const canonicalRedirectMiddleware = createMiddleware().server(
  async ({ next }) => {
    const request = getRequest();
    if (!request) return next();

    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Only consolidate www → bare domain. Do NOT redirect *.lovable.app —
    // Vercel proxies /_serverFn/* and /api/* to ebsustudentsplug.lovable.app,
    // and redirecting that host back to .fun breaks the proxy round-trip
    // (Vercel doesn't follow the 301 and returns the Lovable 404 HTML).
    if (host === "www.ebsustudentsplug.fun") {
      const target = new URL(
        url.pathname + url.search + url.hash,
        `https://${CANONICAL_DOMAIN}`,
      );
      return new Response(null, {
        status: 301,
        headers: {
          Location: target.toString(),
          "Cache-Control": "public, max-age=86400",
          Link: `<${target.toString()}>; rel="canonical"`,
        },
      });
    }

    // Keep the Lovable-hosted origin out of Google without redirecting it —
    // Vercel still proxies /_serverFn/* and /api/* to that host.
    if (host.endsWith(".lovable.app")) {
      const result = (await next()) as unknown;
      if (result instanceof Response) {
        try {
          result.headers.set("X-Robots-Tag", "noindex, nofollow");
        } catch {
          /* immutable headers — ignore */
        }
      }
      return result as Awaited<ReturnType<typeof next>>;
    }

    return next();
  },
);

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [canonicalRedirectMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
