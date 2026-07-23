import { createStart, createMiddleware } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { renderErrorPage } from "./lib/error-page";

const CANONICAL_DOMAIN = "ebsustudentsplug.fun";

const canonicalRedirectMiddleware = createMiddleware().server(
  async ({ request, next }) => {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Redirect any .lovable.app host (published, preview, project--) to the
    // canonical custom domain so visitors and crawlers always land on .fun.
    if (host.endsWith(".lovable.app")) {
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
