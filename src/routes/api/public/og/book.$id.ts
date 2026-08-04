import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://ebsustudentsplug.fun";
const FALLBACK = `${SITE}/og-book.jpg`;

// Every shared book link points at this endpoint. It resolves the book's OWN
// cover (signing private storage URLs when needed), then renders it onto a
// 1200x630 JPEG card — the same share resolution as the news images — so each
// book previews with its own artwork instead of a single generic image.
const SIGN_BUCKETS = ["covers", "book-covers", "blog-images", "post-images", "post-media", "banners"];

function parseStorageUrl(url: string) {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2].split("?")[0]) };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/og/book/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const redirect = (to: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: to, "Cache-Control": "public, max-age=3600, s-maxage=86400" },
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

          let cover = String(data?.cover_url ?? "").trim();
          if (!cover) return redirect(FALLBACK);

          // Private storage URLs need a signed URL before we can fetch them.
          const parsed = cover.startsWith("http") ? parseStorageUrl(cover) : null;
          if (parsed && SIGN_BUCKETS.includes(parsed.bucket)) {
            const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 600);
            if (signed.data?.signedUrl) cover = signed.data.signedUrl;
          } else if (!cover.startsWith("http")) {
            const [bucket, ...rest] = cover.replace(/^\/+/, "").split("/");
            if (bucket && rest.length) {
              const signed = await supabaseAdmin.storage.from(bucket).createSignedUrl(rest.join("/"), 600);
              if (signed.data?.signedUrl) cover = signed.data.signedUrl;
            }
          }
          if (!cover.startsWith("http")) return redirect(FALLBACK);

          const res = await fetch(cover, {
            headers: { "User-Agent": "Mozilla/5.0 StudentsPlugBot", Accept: "image/*" },
          });
          if (!res.ok) return redirect(FALLBACK);
          const contentType = res.headers.get("content-type") ?? "";
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (!bytes.byteLength) return redirect(FALLBACK);

          const { decodeImage, buildOgCard } = await import("@/lib/og-card.server");
          const raster = decodeImage(bytes, contentType);
          if (raster && raster.width > 1 && raster.height > 1) {
            const card = buildOgCard(raster);
            return new Response(card.slice().buffer as ArrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": "image/jpeg",
                "Content-Length": String(card.byteLength),
                "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
              },
            });
          }

          // Formats we can't decode (svg/webp/gif) — still serve the book's own
          // image bytes so the preview isn't a generic card.
          if (/^image\//.test(contentType) && !contentType.includes("svg")) {
            return new Response(bytes.slice().buffer as ArrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=604800",
              },
            });
          }
        } catch {
          // fall through to the branded fallback
        }
        return redirect(FALLBACK);
      },
    },
  },
});
