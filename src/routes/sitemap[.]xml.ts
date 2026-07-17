import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://ebsustudentsplug.fun";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [{ data: newsRows }, { data: blogRows }, { data: listingRows }] = await Promise.all([
          supabaseAdmin.from("news_articles").select("slug").eq("status", "published"),
          supabaseAdmin.from("blog_posts").select("slug").eq("published", true),
          supabaseAdmin.from("market_listings").select("id,category,is_sold").eq("is_sold", false),
        ]);

        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/news", changefreq: "daily", priority: "0.9" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/faculties", changefreq: "weekly", priority: "0.8" },
          { path: "/courses", changefreq: "weekly", priority: "0.8" },
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
          const slug = (row as { slug: string }).slug;
          if (slug) entries.push({ path: `/news/${slug}`, changefreq: "weekly", priority: "0.7" });
        }
        for (const row of blogRows ?? []) {
          const slug = (row as { slug: string }).slug;
          if (slug) entries.push({ path: `/blog/${slug}`, changefreq: "weekly", priority: "0.6" });
        }
        for (const row of listingRows ?? []) {
          const r = row as { id: string; category: string | null };
          if (!r.id) continue;
          // Hostels/apartments get a higher priority so crawlers surface them
          // for renters searching EBSU housing.
          const isHostel = (r.category ?? "").toLowerCase() === "hostel";
          entries.push({
            path: `/market/${r.id}`,
            changefreq: isHostel ? "daily" : "weekly",
            priority: isHostel ? "0.8" : "0.6",
          });
        }




        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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
