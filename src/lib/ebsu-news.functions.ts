import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_KEYS, googleChat, googleImage } from "./google-ai";
import { z } from "zod";

// ---------- helpers ----------
function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; StudentsPlugBot/1.0; +https://studentsplug.app)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // strip scripts/styles/tags
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return stripped.slice(0, 6000);
  } catch (e) {
    console.error("fetchPageText fail", url, e);
    return "";
  }
}

async function aiJSON(prompt: string, system: string): Promise<any> {
  const key = AI_KEYS.news();
  if (!key) throw new Error("NEWS_AI_KEY missing");
  const txt = await googleChat({
    apiKey: key,
    model: "gemini-2.5-flash",
    system,
    messages: [{ role: "user", content: prompt }],
    json: true,
  });
  try {
    return JSON.parse(txt);
  } catch {
    const m = txt.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 StudentsPlugBot/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 6_000_000) return null; // ~6MB cap
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${ct};base64,${b64}`;
  } catch (e) {
    console.error("fetchImage fail", url, e);
    return null;
  }
}

async function generateCover(
  prompt: string,
  refImageDataUrls: string[] = [],
): Promise<string | null> {
  const key = AI_KEYS.news();
  if (!key) return null;
  try {
    const { BRAND_LOGO_DATA_URL } = await import("./brand-logo-b64");
    const brandInstruction =
      "Create an editorial magazine-style cover photo for an Ebonyi State University (EBSU) news story. Bright, vibrant, real-world Nigerian university setting. " +
      (refImageDataUrls.length > 0
        ? "Use the supplied reference image(s) as the main subject/scene — blend, restyle and integrate them naturally into the composition. "
        : "") +
      "IMPORTANT BRANDING: place the supplied StudentsPlug logo (the SG upward-arrow mark) as a small, clean watermark in a corner of the image — keep it crisp, unaltered, and clearly visible but not overpowering. Do NOT invent other text, letters, taglines or logos anywhere else in the image. " +
      `Subject / story: ${prompt}`;

    const refs = [...refImageDataUrls.slice(0, 3), BRAND_LOGO_DATA_URL];
    const models = [
      "google/gemini-2.5-flash-image-preview",
      "google/gemini-3-pro-image",
      "openai/gpt-image-1",
    ];
    let img: { base64: string; mimeType: string } | null = null;
    let lastErr: unknown = null;
    for (const model of models) {
      try {
        img = await googleImage({ apiKey: key, prompt: brandInstruction, refImages: refs, model });
        if (img) break;
      } catch (e) {
        lastErr = e;
        console.error("cover gen model failed", model, e);
      }
    }
    if (!img) {
      if (lastErr) console.error("cover gen all models failed", lastErr);
      return null;
    }
    const buf = Buffer.from(img.base64, "base64");
    const path = `ebsu-news/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.png`;
    const { error } = await supabaseAdmin.storage
      .from("post-images")
      .upload(path, buf, { contentType: img.mimeType || "image/png", upsert: false });
    if (error) {
      console.error("cover upload err", error);
      return null;
    }
    return supabaseAdmin.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("cover gen err", e);
    return null;
  }
}


// ---------- sources CRUD ----------
export const listSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");
    const { data, error } = await supabaseAdmin
      .from("ebsu_news_sources")
      .select("*")
      .order("weight", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; url: string; label?: string; weight?: number; is_active?: boolean }) =>
    z
      .object({
        id: z.string().uuid().optional(),
        url: z.string().url().max(500),
        label: z.string().max(120).optional(),
        weight: z.number().int().min(1).max(10).default(1),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("ebsu_news_sources")
        .update({ url: data.url, label: data.label ?? null, weight: data.weight, is_active: data.is_active })
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from("ebsu_news_sources")
        .insert({ url: data.url, label: data.label ?? null, weight: data.weight, is_active: data.is_active });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");
    const { error } = await supabaseAdmin.from("ebsu_news_sources").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- generate news ----------
function extractUrls(text: string): string[] {
  if (!text) return [];
  const re = /https?:\/\/[^\s"'<>)\]]+/gi;
  const found = Array.from(new Set((text.match(re) ?? []).map((u) => u.replace(/[.,;:!?)\]]+$/, ""))));
  return found.slice(0, 6);
}

async function runGenerate(opts: {
  topic?: string;
  sourceUrls: string[];
  publish: boolean;
  authorId: string | null;
}) {
  // Pull URLs the editor typed into the brief and merge with saved sources.
  // Split out image URLs — they become reference images for the cover art,
  // not article sources to scrape.
  const inlineUrls = extractUrls(opts.topic ?? "");
  const isImg = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u);
  const inlineImageUrls = inlineUrls.filter(isImg);
  const inlineArticleUrls = inlineUrls.filter((u) => !isImg(u));
  const merged = Array.from(
    new Set([...(opts.sourceUrls ?? []), ...inlineArticleUrls]),
  ).slice(0, 8);
  const sources = merged;
  const hasSources = sources.length > 0;

  const hasTopic = !!(opts.topic && opts.topic.trim().length > 0);
  if (!hasSources && !hasTopic) {
    throw new Error("Add at least one source or write an editor brief.");
  }

  // 1. Scrape (only if sources provided)
  let usable: { url: string; text: string }[] = [];
  if (hasSources) {
    const scraped = await Promise.all(
      sources.map(async (u) => ({ url: u, text: await fetchPageText(u) })),
    );
    usable = scraped.filter((s) => s.text.length > 200);
    if (usable.length === 0 && !hasTopic) {
      throw new Error("Could not fetch any source content");
    }
  }


  // 2. Synthesize
  const sourcedRules = `ACCURACY RULES (non-negotiable):
1. Use ONLY facts that appear verbatim in the supplied sources. Do NOT invent dates, names, fees, deadlines, statistics, course codes, or quotes.
2. If a key detail (e.g. a date or amount) is missing or ambiguous in the sources, write the article without it — never guess.
3. Do not fabricate quotes. If you cite someone, the exact sentence must appear in the source text.
4. Do not promise anything ("admissions are now open", "results released") unless the source explicitly says so.
5. List the source URLs you actually used in "sources_used" — rendered as a separate "Sources" section by the site.`;

  const briefRules = `EDITOR-BRIEF MODE (no external sources):
1. Base the article strictly on the editor brief supplied below. Do not fabricate specific dates, fees, names, quotes, or statistics that are not in the brief.
2. If the brief is short, expand it into a well-structured article about EBSU with helpful context students already know.
3. Leave "sources_used" as an empty array [].`;

  const system = `You are the senior editor and campus intelligence reporter for "EBSU Plug News", a smart, professional student news desk for Ebonyi State University. Your job is to turn raw briefs, source pages, screenshots, and rough notes into accurate, polished, high-signal news articles that feel written by a capable human editor — not by generic AI.

EDITORIAL STANDARD:
- Be precise, calm, and authoritative. Write for busy EBSU students who need the key point fast.
- Lead with the strongest student-relevant news angle in the first paragraph.
- Use clean Nigerian campus English: natural, direct, warm, and professional.
- Avoid hype, filler, exaggerated claims, gossip tone, and generic AI phrases.
- Make the article feel current and useful: explain what happened, who it affects, what students should know, and what comes next if known.
- If details are unclear, state only the confirmed facts and avoid guessing.

${usable.length > 0 ? sourcedRules : briefRules}

BODY STYLE RULES (non-negotiable):
- DO NOT mention, link to, name, or reference source websites, blogs, or publications anywhere in the body or summary. No phrases like "according to X", "as reported by Y", "the source says", "via …", "(see link)", or any inline URLs/footnote markers ([1], [^1], etc.).
- DO NOT include a "Sources", "References", or "Read more" section in the body — the site renders that automatically.
- Write the article as ORIGINAL EBSU Plug News reporting, in your own words, fully self-contained.
- Use short paragraphs. Add ## subheadings only where they improve scanning.
- Keep names, offices, amounts, dates, venues, portals, and deadlines exactly as provided.
- If the story is an announcement, include a practical "What students should do" section when the facts support it.

EDITOR-COMMAND MODE (highest priority):
The editor brief may contain SMART INSTRUCTIONS you MUST follow literally. Examples:
- "Fetch this link and summarize it" → base the article on the fetched source content provided below.
- "Filter out / remove / do not mention X" → the final article must contain zero references to X.
- "Only include the part about Y" → focus the article strictly on Y and drop everything else.
- "Rewrite as a 5-point explainer / breaking news / opinion piece" → obey the requested format.
- "Do NOT post / skip this / not newsworthy / cancel" → return { "skip": true, "reason": "editor asked to skip" }.
- "Keep it short" → 200-400 words. "Long form" → 700-1200 words.
Always obey editor instructions over your default style. If instructions conflict with accuracy rules above, prefer accuracy and note the conflict in "reason".

Return STRICT JSON with this shape:
{
  "title": "punchy headline under 80 chars",
  "summary": "1-2 sentence hook under 200 chars",
  "body": "full article in markdown with a strong lead, clear subheadings where useful, student impact, practical next steps when known, and a concise final 'Bottom line' paragraph.",
  "image_prompt": "professional Nigerian university editorial cover image prompt, realistic, vibrant, no text except the supplied brand watermark handled separately",
  "sources_used": ["https://..."],
  "skip": false
}

If the editor told you to skip, or you truly have nothing to write about, return { "skip": true, "reason": "..." }.`;


  const userPrompt = usable.length > 0
    ? `${hasTopic ? `Editor brief / angle: ${opts.topic}\n\n` : ""}Sources (use ONLY these — do not add outside knowledge):\n\n${usable
        .map((s, i) => `[${i + 1}] ${s.url}\n${s.text}`)
        .join("\n\n---\n\n")}`
    : `Editor brief (write the article from this alone, no external sources):\n\n${opts.topic}`;

  const j = await aiJSON(userPrompt, system);
  if (j.skip) throw new Error(`AI skipped: ${j.reason || "no relevant content"}`);
  if (!j.title || !j.body) throw new Error("AI returned incomplete article");

  // 3. Cover image (best-effort). Fetch any editor-supplied reference images
  // and pass them into the cover generator so the AI can blend them with the
  // StudentsPlug brand watermark.
  const refImageDataUrls = (
    await Promise.all(inlineImageUrls.slice(0, 3).map(fetchImageAsDataUrl))
  ).filter((x): x is string => !!x);
  const imageUrl = await generateCover(j.image_prompt || j.title, refImageDataUrls);


  // 4. Insert
  let slug = slugify(j.title) || `ebsu-${Date.now()}`;
  // ensure unique
  const { data: existing } = await supabaseAdmin
    .from("news_articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const { data: inserted, error } = await supabaseAdmin
    .from("news_articles")
    .insert({
      category: "ebsu",
      status: opts.publish ? "published" : "draft",
      title: String(j.title).slice(0, 200),
      slug,
      summary: j.summary ? String(j.summary).slice(0, 300) : null,
      body: String(j.body),
      image_url: imageUrl,
      source_urls: usable.map((s) => s.url),
      author_id: opts.authorId,
    })
    .select("id, slug")
    .single();
  if (error) throw error;
  return { id: inserted.id, slug: inserted.slug, image_url: imageUrl };
}

export const generateEbsuNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topic?: string; sourceUrls?: string[]; publish?: boolean }) =>
    z
      .object({
        topic: z.string().optional(),
        sourceUrls: z.array(z.string().url()).max(8).optional(),
        publish: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");

    let urls = data.sourceUrls ?? [];
    if (urls.length === 0) {
      const { data: saved } = await supabaseAdmin
        .from("ebsu_news_sources")
        .select("url")
        .eq("is_active", true)
        .order("weight", { ascending: false })
        .limit(6);
      urls = (saved ?? []).map((r) => r.url);
    }
    return runGenerate({
      topic: data.topic,
      sourceUrls: urls,
      publish: data.publish,
      authorId: context.userId,
    });
  });

export const deleteNewsArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");
    const { error } = await supabaseAdmin.from("news_articles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- REMAKE existing article with updated AI features ----------
export const regenerateEbsuNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; extraInstruction?: string }) =>
    z.object({ id: z.string().uuid(), extraInstruction: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("admin only");

    const { data: art, error: loadErr } = await supabaseAdmin
      .from("news_articles")
      .select("id, title, summary, body, source_urls, image_url, status")
      .eq("id", data.id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!art) throw new Error("article not found");

    const savedUrls = Array.isArray(art.source_urls)
      ? (art.source_urls as unknown[]).filter((u): u is string => typeof u === "string")
      : [];

    // Build a topic that pins the AI to the same story but lets it rewrite fully.
    const originalNote = `REMAKE MODE: You are rewriting an existing EBSU Plug News article using the updated news AI. Keep the same underlying story, but produce a fresh, sharper, better-structured article. Do NOT copy sentences verbatim from the original body.

Original headline: ${art.title}
${art.summary ? `Original summary: ${art.summary}\n` : ""}Original body (reference only — rewrite, do not repeat):
"""
${String(art.body).slice(0, 5000)}
"""
${data.extraInstruction ? `\nEXTRA EDITOR INSTRUCTION:\n${data.extraInstruction}\n` : ""}`;

    const scraped = savedUrls.length
      ? (await Promise.all(savedUrls.map(async (u) => ({ url: u, text: await fetchPageText(u) })))).filter(
          (s) => s.text.length > 200,
        )
      : [];

    const sourcedRules = `ACCURACY RULES (non-negotiable):
1. Use ONLY facts that appear verbatim in the supplied sources or the original article body. Do NOT invent dates, names, fees, deadlines, statistics, course codes, or quotes.
2. If a key detail is missing or ambiguous, write the article without it — never guess.
3. Do not fabricate quotes.
4. List the source URLs you actually used in "sources_used".`;

    const briefRules = `REMAKE-FROM-ORIGINAL MODE (no external sources fetched):
1. Base the new article strictly on the original body supplied. Do not invent new facts.
2. Improve structure, clarity, headings, and hook. Add "what this means for students" framing where natural.
3. Leave "sources_used" as an empty array [].`;

    const system = `You are the editor of "EBSU Plug News" — a sharp, student-first news desk covering Ebonyi State University. You are REMAKING an existing article to a higher standard using the updated AI features.

${scraped.length > 0 ? sourcedRules : briefRules}

BODY STYLE RULES (non-negotiable):
- DO NOT mention, link to, name, or reference source websites, blogs, or publications anywhere in the body or summary. No inline URLs or footnote markers.
- DO NOT include a "Sources" or "References" section — the site renders that automatically.
- Write as ORIGINAL EBSU Plug News reporting, in your own words, fully self-contained.
- Use ## subheadings, tight paragraphs, and end with a short "Bottom line" line.

Return STRICT JSON:
{
  "title": "punchy headline under 80 chars",
  "summary": "1-2 sentence hook under 200 chars",
  "body": "full article in markdown",
  "image_prompt": "short visual prompt for cover photo, no text or logos",
  "sources_used": ["https://..."],
  "skip": false
}`;

    const userPrompt = scraped.length
      ? `${originalNote}\n\nFresh source scrapes (prefer these facts over the original body when they conflict):\n\n${scraped
          .map((s, i) => `[${i + 1}] ${s.url}\n${s.text}`)
          .join("\n\n---\n\n")}`
      : originalNote;

    const j = await aiJSON(userPrompt, system);
    if (j.skip) throw new Error(`AI skipped remake: ${j.reason || "no content"}`);
    if (!j.title || !j.body) throw new Error("AI returned incomplete article");

    const imageUrl = await generateCover(j.image_prompt || j.title, []);

    const { error: updErr } = await supabaseAdmin
      .from("news_articles")
      .update({
        title: String(j.title).slice(0, 200),
        summary: j.summary ? String(j.summary).slice(0, 300) : null,
        body: String(j.body),
        image_url: imageUrl ?? art.image_url,
        source_urls: scraped.length ? scraped.map((s) => s.url) : savedUrls,
      })
      .eq("id", data.id);
    if (updErr) throw updErr;

    return { id: data.id, image_url: imageUrl ?? art.image_url };
  });

// internal helper for cron
export async function _autoGenerateForCron() {
  const { data: saved } = await supabaseAdmin
    .from("ebsu_news_sources")
    .select("url")
    .eq("is_active", true)
    .order("weight", { ascending: false })
    .limit(6);
  const urls = (saved ?? []).map((r) => r.url);
  if (urls.length === 0) return { skipped: "no sources" };
  return runGenerate({ sourceUrls: urls, publish: true, authorId: null });
}
