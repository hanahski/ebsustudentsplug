import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { AI_KEYS, googleImage } from "./google-ai";

const InputSchema = z.object({
  prompt: z.string().min(3).max(800),
});

/**
 * Generate an AI image from a text prompt and upload it to the
 * `post-images` bucket. Returns the public URL.
 * Uses NEWS_AI_KEY (Google AI Studio) — same key group as News AI.
 */
export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = AI_KEYS.news();
    if (!apiKey) throw new Error("NEWS_AI_KEY missing");

    const img = await googleImage({
      apiKey,
      prompt: `${data.prompt}. Editorial, high quality, vibrant, suitable for a social media post. No text, no watermarks, no logos.`,
    });
    if (!img) throw new Error("No image returned");

    const bin = atob(img.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const path = `${userId}/${Date.now()}-ai.png`;
    const up = await supabaseAdmin.storage
      .from("post-images")
      .upload(path, bytes, { contentType: img.mimeType || "image/png", upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = supabaseAdmin.storage.from("post-images").getPublicUrl(path);
    return { url: pub.publicUrl };
  });
