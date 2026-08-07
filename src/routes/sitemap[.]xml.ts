import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://ebsustudentsplug.fun";

interface SitemapImage {
  loc: string;
  title?: string;
  caption?: string;
}

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  images?: SitemapImage[];
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Only absolute http(s) URLs are valid inside <image:loc>. */
const absImage = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^https?:\/\//i.test(s) ? s : null;
};

const isoDate = (v: unknown): string | undefined => {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { getPublicReadClient } = await import("@/lib/supabase-read.server");
        let newsRows: any[] | null = null;
        let blogRows: any[] | null = null;
        let listingRows: any[] | null = null;
        let ticketRows: any[] | null = null;
        let bookRows: any[] | null = null;
        try {
          const db: any = await getPublicReadClient();
          const [news, blog, listings, tickets, books] = await Promise.all([
            db
              .from("news_articles")
              .select("slug,title,summary,image_url,published_at,updated_at")
              .eq("status", "published"),
            db.from("blog_posts").select("slug,title,cover_url,published_at").eq("published", true),
            db
              .from("market_listings")
              .select("id,title,category,photos,is_sold,created_at")
              .eq("is_sold", false),
            db.from("tickets").select("id,title,photo_url,created_at"),
            db.from("library_books").select("id,title,cover_url"),
          ]);
          newsRows = news.data;
          blogRows = blog.data;
          listingRows = listings.data;
          ticketRows = tickets.data;
          bookRows = books.data;
        } catch (error) {
          // Never 500 the sitemap — Search Console reports "Couldn't fetch".
          console.error("[sitemap] dynamic content read failed", error);
        }


        const entries: SitemapEntry[] = [
          {
            path: "/",
            changefreq: "daily",
            priority: "1.0",
            images: [{ loc: `${BASE_URL}/brand-logo.png`, title: "StudentsPlug logo" }],
          },
          { path: "/news", changefreq: "daily", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/faculties", changefreq: "weekly", priority: "0.8" },
          { path: "/courses", changefreq: "weekly", priority: "0.8" },
          { path: "/school-biography", changefreq: "weekly", priority: "0.7" },
          { path: "/books", changefreq: "weekly", priority: "0.7" },
          { path: "/market", changefreq: "daily", priority: "0.8" },
          { path: "/products", changefreq: "daily", priority: "0.8" },
          { path: "/tickets", changefreq: "weekly", priority: "0.7" },
          { path: "/games", changefreq: "monthly", priority: "0.5" },
          { path: "/tools", changefreq: "monthly", priority: "0.5" },
          { path: "/guides/ebsu-fees", changefreq: "monthly", priority: "0.7" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy", changefreq: "yearly", priority: "0.4" },
          { path: "/terms", changefreq: "yearly", priority: "0.4" },
        ];

        for (const row of newsRows ?? []) {
          const r = row as any;
          if (!r.slug) continue;
          const img = absImage(r.image_url);
          entries.push({
            path: `/news/${r.slug}`,
            changefreq: "weekly",
            priority: "0.7",
            lastmod: isoDate(r.updated_at) ?? isoDate(r.published_at),
            images: img ? [{ loc: img, title: r.title, caption: r.summary ?? undefined }] : undefined,
          });
        }
        for (const row of blogRows ?? []) {
          const r = row as any;
          if (!r.slug) continue;
          const img = absImage(r.cover_url);
          entries.push({
            path: `/blog/${r.slug}`,
            changefreq: "weekly",
            priority: "0.6",
            lastmod: isoDate(r.published_at),
            images: img ? [{ loc: img, title: r.title }] : undefined,
          });
        }
        for (const row of listingRows ?? []) {
          const r = row as any;
          if (!r.id) continue;
          // Hostels/apartments get a higher priority so crawlers surface them
          // for renters searching EBSU housing.
          const isHostel = (r.category ?? "").toLowerCase() === "hostel";
          const photos: string[] = Array.isArray(r.photos)
            ? (r.photos as unknown[]).map(absImage).filter((p): p is string => !!p).slice(0, 5)
            : [];
          entries.push({
            path: `/market/${r.id}`,
            changefreq: isHostel ? "daily" : "weekly",
            priority: isHostel ? "0.8" : "0.6",
            lastmod: isoDate(r.created_at),
            images: photos.length ? photos.map((loc) => ({ loc, title: r.title })) : undefined,
          });
        }
        for (const row of ticketRows ?? []) {
          const r = row as any;
          if (!r.id) continue;
          const img = absImage(r.photo_url);
          entries.push({
            path: `/tickets/${r.id}`,
            changefreq: "weekly",
            priority: "0.6",
            lastmod: isoDate(r.created_at),
            images: img ? [{ loc: img, title: r.title }] : undefined,
          });
        }
        for (const row of bookRows ?? []) {
          const r = row as any;
          if (!r.id) continue;
          // Every book has a guaranteed raster share card at this endpoint,
          // so image crawlers always get something valid.
          entries.push({
            path: `/books/read/${r.id}`,
            changefreq: "monthly",
            priority: "0.5",
            images: [
              { loc: `${BASE_URL}/api/public/og/book/${r.id}`, title: r.title },
              ...(absImage(r.cover_url) ? [{ loc: absImage(r.cover_url)!, title: r.title }] : []),
            ],
          });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            ...(e.images ?? []).map((img) =>
              [
                `    <image:image>`,
                `      <image:loc>${esc(img.loc)}</image:loc>`,
                img.title ? `      <image:title>${esc(String(img.title))}</image:title>` : null,
                img.caption ? `      <image:caption>${esc(String(img.caption))}</image:caption>` : null,
                `    </image:image>`,
              ]
                .filter(Boolean)
                .join("\n"),
            ),
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
