// Fetches a news article and extracts main text + images via r.jina.ai reader.
import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

export const Route = createFileRoute("/api/news/read")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const target = u.searchParams.get("url") ?? "";
        if (!target || !/^https?:\/\//i.test(target)) {
          return json({ error: "invalid url" }, 400);
        }
        try {
          const res = await fetch(`https://r.jina.ai/${target}`, {
            headers: {
              "X-Return-Format": "markdown",
              "Accept": "text/plain",
              "User-Agent": "StudentsPlug/1.0",
            },
          });
          if (!res.ok) {
            return json({ error: `reader upstream ${res.status}` }, 502);
          }
          const markdown = await res.text();
          // Strip the leading "Title: ...\nURL Source: ...\n\nMarkdown Content:\n" prelude if present
          const cleaned = markdown
            .replace(/^Title:\s.*\n/i, "")
            .replace(/^URL Source:\s.*\n/im, "")
            .replace(/^Published Time:\s.*\n/im, "")
            .replace(/^Markdown Content:\s*\n/im, "")
            .trim();
          return json({ markdown: cleaned });
        } catch (e: any) {
          return json({ error: e?.message ?? "reader failed" }, 502);
        }
      },
    },
  },
});
