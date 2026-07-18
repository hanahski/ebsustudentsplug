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

// Fire-and-forget IndexNow ping from the server. Runs in the Worker after the
// insert resolves; failures are swallowed so a bad ping never fails a publish.
function pingIndexNowServer(paths: string[]) {
  const SITE = "https://ebsustudentsplug.fun";
  const urls = paths.map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? "" : "/"}${p}`));
  try {
    fetch(`${SITE}/api/public/hooks/indexnow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    }).catch(() => {});
  } catch { /* noop */ }
}


async function assertCanPost(ctx: { userId: string; supabase: any }) {
  const { data: role } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (role) return { isAdmin: true, isVerifiedSource: true, isTrusted: true, sourceName: null as string | null, displayName: "Admin" } as const;
  const { data: prof } = await ctx.supabase
    .from("profiles")
    .select("is_legit, is_verified_source, is_trusted_source, source_name, display_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  // Allow legacy is_legit users OR new is_verified_source. Admin flips these in the panel.
  const allowed = !!(prof?.is_verified_source || prof?.is_legit);
  if (!allowed) {
    throw new Error("Only verified sources and admins can post EBSU news.");
  }
  return {
    isAdmin: false,
    isVerifiedSource: !!prof?.is_verified_source,
    isTrusted: !!prof?.is_trusted_source,
    sourceName: (prof?.source_name as string) ?? null,
    displayName: (prof?.display_name as string) ?? "StudentsPlug Writer",
  } as const;
}

// Public flag the client uses to show/hide the FAB.
export const canPostEbsuNews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const r = await assertCanPost(context as any);
      return {
        allowed: true,
        isAdmin: r.isAdmin,
        isVerifiedSource: r.isVerifiedSource,
        isTrusted: r.isTrusted,
        sourceName: r.sourceName,
      };
    } catch {
      return { allowed: false, isAdmin: false, isVerifiedSource: false, isTrusted: false, sourceName: null };
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
    // Admins publish immediately. Verified sources create a pending submission —
    // the DB trigger auto-publishes for trusted sources.
    const isAdmin = perms.isAdmin;
    const initialStatus = isAdmin ? (data.publish ? "published" : "draft") : "pending";
    const { data: row, error } = await (supabaseAdmin as any)
      .from("news_articles")
      .insert({
        category: "ebsu",
        status: initialStatus,
        title: `${prefix}${finalTitle}`.slice(0, 200),
        slug,
        summary: (data.summary || "").slice(0, 300) || null,
        body: data.body,
        image_url: data.imageUrl ?? null,
        source_urls: data.sourceUrls ?? [],
        author_id: context.userId,
        submitted_by: context.userId,
        published_at: isAdmin && data.publish ? publishedAt : null,
      })
      .select("id, slug, status")
      .single();
    if (error) throw new Error(error.message);
    if (row.status === "published") pingIndexNowServer([`/news/${row.slug}`, "/news", "/sitemap.xml"]);
    return { id: row.id, slug: row.slug, type: data.type, status: row.status as string };
  });


// ============ Submissions: user + admin ============

export const listMyNewsSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("news_articles")
      .select("id, slug, title, status, created_at, reviewed_at, rejection_reason, image_url")
      .eq("submitted_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return { rows: data ?? [] };
  });


async function assertAdmin(ctx: { userId: string; supabase: any }) {
  const { data } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("admin only");
}

export const adminListPendingSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("news_articles")
      .select("id, slug, title, summary, body, image_url, created_at, submitted_by")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.submitted_by).filter(Boolean)));
    let profiles: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar_key, source_name, is_trusted_source")
        .in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    return { rows: (rows ?? []).map((r: any) => ({ ...r, submitter: profiles[r.submitted_by] ?? null })) };
  });

export const adminReviewNewsSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    articleId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase.rpc("admin_review_submission", {
      _article_id: data.articleId,
      _decision: data.decision,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    if (data.decision === "approve") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin
        .from("news_articles").select("slug").eq("id", data.articleId).maybeSingle();
      if (row?.slug) pingIndexNowServer([`/news/${row.slug}`, "/news", "/sitemap.xml"]);
    }
    return { ok: true };
  });

export const adminSearchSourceCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${data.query}%`;
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, avatar_key, is_verified_source, is_trusted_source, source_name, is_legit")
      .or(`display_name.ilike.${like},email.ilike.${like},source_name.ilike.${like}`)
      .limit(15);
    return { rows: rows ?? [] };
  });

export const adminListVerifiedSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, avatar_key, is_verified_source, is_trusted_source, source_name")
      .eq("is_verified_source", true)
      .order("source_name", { ascending: true, nullsFirst: false })
      .limit(100);
    return { rows: rows ?? [] };
  });

export const adminSetSourceFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    userId: z.string().uuid(),
    isVerifiedSource: z.boolean().nullable().optional(),
    isTrustedSource: z.boolean().nullable().optional(),
    sourceName: z.string().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await context.supabase.rpc("admin_set_source_flags", {
      _user_id: data.userId,
      _is_verified_source: data.isVerifiedSource ?? null,
      _is_trusted_source: data.isTrustedSource ?? null,
      _source_name: data.sourceName ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
