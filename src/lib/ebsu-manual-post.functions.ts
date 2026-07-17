// Manual EBSU post composer — server functions.
// Legit-badge users AND admins can post EBSU news, announcements, or blog posts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_KEYS, googleChat } from "./google-ai";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `post-${Date.now().toString(36)}`;
}

async function assertCanPost(ctx: { userId: string; supabase: any }) {
  const { data: role } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return { isAdmin: true, isLegit: true } as const;
  const { data: prof } = await ctx.supabase
    .from("profiles")
    .select("is_legit, display_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (!prof?.is_legit) {
    throw new Error("Only verified legit-badge users and admins can post EBSU news.");
  }
  return { isAdmin: false, isLegit: true, displayName: prof.display_name as string } as const;
}

// Public flag the client uses to show/hide the FAB.
export const canPostEbsuNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const r = await assertCanPost(context as any);
      return { allowed: true, isAdmin: r.isAdmin };
    } catch {
      return { allowed: false, isAdmin: false };
    }
  });

const PostInput = z.object({
  type: z.enum(["news", "announcement", "blog"]),
  title: z.string().trim().min(4).max(200),
  slug: z.string().trim().max(90).optional(),
  summary: z.string().trim().max(400).optional(),
  body: z.string().min(10).max(60_000),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  sourceUrls: z.array(z.string().url()).max(8).optional(),
  publish: z.boolean().default(true),
  breaking: z.boolean().default(false),
  publishAt: z.string().datetime().optional(),
});

export const publishManualEbsuPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => PostInput.parse(d))
  .handler(async ({ data, context }) => {
    const perms = await assertCanPost(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const finalTitle = data.breaking && data.type === "news"
      ? (data.title.toUpperCase().startsWith("BREAKING") ? data.title : `BREAKING: ${data.title}`)
      : data.title;

    let slug = data.slug ? slugify(data.slug) : slugify(finalTitle);
    const publishedAt = data.publishAt ?? new Date().toISOString();

    if (data.type === "blog") {
      // Ensure unique slug on blog_posts
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await supabaseAdmin
          .from("blog_posts").select("id").eq("slug", slug).maybeSingle();
        if (!exists) break;
        slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      }
      const { data: row, error } = await supabaseAdmin
        .from("blog_posts")
        .insert({
          title: finalTitle,
          slug,
          excerpt: (data.summary || finalTitle).slice(0, 300),
          content: data.body,
          cover_url: data.imageUrl ?? null,
          tags: data.tags ?? [],
          author_name: perms.isAdmin ? "StudentsPlug Editors" : ((perms as any).displayName ?? "StudentsPlug Writer"),
          published: data.publish,
          published_at: publishedAt,
        })
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      if (data.publish) pingIndexNowServer([`/blog/${row.slug}`, "/blog", "/sitemap.xml"]);
      return { id: row.id, slug: row.slug, type: "blog" as const };
    }

    // news + announcement -> news_articles
    const prefix = data.type === "announcement" ? "📢 " : "";
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabaseAdmin
        .from("news_articles").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    }
    const { data: row, error } = await supabaseAdmin
      .from("news_articles")
      .insert({
        category: "ebsu",
        status: data.publish ? "published" : "draft",
        title: `${prefix}${finalTitle}`.slice(0, 200),
        slug,
        summary: (data.summary || "").slice(0, 300) || null,
        body: data.body,
        image_url: data.imageUrl ?? null,
        source_urls: data.sourceUrls ?? [],
        author_id: context.userId,
        published_at: publishedAt,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, slug: row.slug, type: data.type };
  });

// Small AI helper — title suggestions, summary, rewrite polish.
export const aiAssistNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mode: "title" | "summary" | "rewrite" | "expand"; text: string; context?: string }) =>
    z.object({
      mode: z.enum(["title", "summary", "rewrite", "expand"]),
      text: z.string().min(2).max(6000),
      context: z.string().max(400).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanPost(context as any);
    if (!AI_KEYS.news()) throw new Error("News AI not configured");

    const systems: Record<string, string> = {
      title: "You write punchy, factual news headlines for Ebonyi State University students. Return ONLY the headline text, max 90 chars, no quotes, no emojis, no markdown.",
      summary: "You write short editorial summaries for EBSU campus news. Return ONLY the summary, 1-2 sentences, max 240 chars, plain text.",
      rewrite: "You polish EBSU news drafts. Keep the meaning and facts, tighten the prose, fix grammar, make it flow, stay in Nigerian-English tone. Return ONLY the rewritten HTML (keep <p>, <h2>, <ul>, <blockquote>, <a>) — no code fences, no commentary.",
      expand: "You expand a short EBSU note into a fuller article of 3-5 short paragraphs. Return ONLY the article body as HTML with <p> tags — no code fences, no commentary.",
    };
    const userPrompt = data.context ? `${data.context}\n\n---\n${data.text}` : data.text;
    const out = await googleChat({
      system: systems[data.mode],
      messages: [{ role: "user", content: userPrompt }],
    });
    return { text: (out || "").trim().replace(/^```(?:html)?\s*|\s*```$/g, "") };
  });
