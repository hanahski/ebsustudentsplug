// Auto-generate a Nigerian novel listing.
// Text uses TOOLS_AI_KEY (Book AI writing group); cover uses BOOK_IMAGE_AI_KEY.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_KEYS, googleChat, googleImage } from "@/lib/google-ai";
import { requireCronSecret } from "@/lib/cron-auth.server";

const GENRES = [
  { genre: "campus romance", premise: "A first-year EBSU student falls for a final-year hostel rep amid a missing-textbook mystery." },
  { genre: "thriller", premise: "An accounting student uncovers a cult laundering money through a campus tuck-shop." },
  { genre: "comedy", premise: "Three roommates pool credits to win the inter-faculty cooking showdown." },
  { genre: "spiritual fiction", premise: "A quiet medical student in Abakaliki begins seeing the prayers of strangers as ribbons of light." },
  { genre: "tech startup", premise: "Two computer-science students build a campus food-delivery app — and accidentally go viral." },
  { genre: "family drama", premise: "A girl from Abakaliki returns home after JAMB and discovers her father's hidden second family." },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

async function generateCover(prompt: string): Promise<Buffer | null> {
  const key = AI_KEYS.bookImage();
  if (!key) return null;
  try {
    const img = await googleImage({
      apiKey: key,
      prompt: `Photorealistic Nigerian novel book cover photograph, portrait 2:3 aspect ratio, cinematic moody lighting, real Nigerian people and setting, magazine-quality photography (NOT illustration, NOT cartoon, NOT 3D). Composition leaves clean negative space at top for a title. No text, no letters, no logos. Scene: ${prompt}`,
    });
    return img ? Buffer.from(img.base64, "base64") : null;
  } catch {
    return null;
  }
}

async function generateOne() {
  const textKey = AI_KEYS.tools();
  if (!textKey) throw new Error("TOOLS_AI_KEY missing");
  const pick = GENRES[Math.floor(Math.random() * GENRES.length)];
  const prompt = `Write a short Nigerian novel listing for a campus marketplace. Genre: ${pick.genre}. Premise: ${pick.premise}.
Return STRICT JSON only (no markdown fences) with keys:
{"title": string (max 70 chars, evocative), "description": string (250-350 words, 3 paragraphs, hook + setup + cliffhanger; mention real Nigerian places naturally), "price": integer in Naira between 1500 and 4500, "cover_prompt": string (one-sentence photo description, no text/letters)}`;

  const raw = await googleChat({
    apiKey: textKey,
    model: "gemini-2.5-flash",
    system: "You are a Nigerian novelist. Respond with valid JSON only.",
    messages: [{ role: "user", content: prompt }],
    json: true,
  });
  const clean = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean) as { title: string; description: string; price: number; cover_prompt?: string };

  let cover_url: string | null = null;
  const buf = await generateCover(parsed.cover_prompt ?? parsed.title);
  if (buf) {
    const path = `novel-${slugify(parsed.title)}-${Date.now().toString(36)}.png`;
    const { error: upErr } = await supabaseAdmin.storage.from("blog-images").upload(path, buf, {
      contentType: "image/png", upsert: true,
    });
    if (!upErr) {
      const { data: pub } = supabaseAdmin.storage.from("blog-images").getPublicUrl(path);
      cover_url = pub.publicUrl;
    }
  }

  const { data: adminRow } = await supabaseAdmin
    .from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  const seller_id = adminRow?.user_id;
  if (!seller_id) throw new Error("no admin seller to attribute novel to");

  const { error } = await supabaseAdmin.from("market_listings").insert({
    seller_id,
    title: parsed.title,
    description: parsed.description,
    price: Math.max(1500, Math.min(4500, Math.round(parsed.price ?? 2500))),
    category: "books",
    listing_kind: "books",
    contact: "Auto-listed by The Plug AI",
    location: "EBSU campus",
    photos: cover_url ? [cover_url] : [],
    cover_url,
    is_ai_generated: true,
  });
  if (error) throw error;
  return { title: parsed.title, cover_url };
}

export const Route = createFileRoute("/api/public/hooks/generate-novel")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = requireCronSecret(request);
        if (unauthorized) return unauthorized;
        try {
          const r = await generateOne();
          return new Response(JSON.stringify({ ok: true, ...r }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("generate-novel:", e);
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async ({ request }) => {
        const unauthorized = requireCronSecret(request);
        if (unauthorized) return unauthorized;
        return new Response("ok");
      },
    },
  },
});
