import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://ebsustudentsplug.fun";
const FALLBACK = `${SITE}/og-book.jpg`;

// Social crawlers (WhatsApp, Facebook, X, Telegram) only render raster
// images. Book covers come from many upstream sources — some are SVG, some
// are missing entirely — so every shared book link points at this endpoint
// and we redirect to a safe raster image (or the branded fallback).
function isRaster(url: string) {
  const path = url.split("?")[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(path);
}

export const Route = createFileRoute("/api/public/og/book/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const redirect = (to: string) =>
          new Response(null, {
            status: 302,
            headers: {
              Location: to,
              "Cache-Control": "public, max-age=3600, s-maxage=86400",
            },
          });

        const id = String(params.id ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(id)) return redirect(FALLBACK);

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("library_books")
            .select("cover_url")
            .eq("id", id)
            .maybeSingle();
          const cover = String(data?.cover_url ?? "").trim();
          if (cover.startsWith("http") && isRaster(cover)) return redirect(cover);
        } catch {
          // fall through to the branded fallback
        }
        return redirect(FALLBACK);
      },
    },
  },
});
