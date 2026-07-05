import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cover image is now supplied by the caller (typically the first scanned
// page) as a data URL. No AI is used, so this works without LOVABLE_API_KEY.
async function uploadDataUrl(
  userId: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const m = /^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) return null;
    const mime = m[1];
    const b64 = m[2];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = mime.split("/")[1]?.split("+")[0] || "png";
    const path = `${userId}/${Date.now()}-scan.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("post-images")
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) {
      console.error("upload err", error);
      return null;
    }
    return supabaseAdmin.storage.from("post-images").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.error("cover upload err", e);
    return null;
  }
}

export const postFromScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    title: string;
    body: string;
    courseId?: string | null;
    coverDataUrl?: string | null;
  }) => ({
    title: String(d.title ?? "").trim().slice(0, 160),
    body: String(d.body ?? "").trim().slice(0, 20000),
    courseId: d.courseId || null,
    coverDataUrl: d.coverDataUrl || null,
  }))
  .handler(async ({ data, context }) => {
    if (!data.title) throw new Error("Title required");
    if (!data.body) throw new Error("Body required");
    const userId = context.userId;

    const image_url = data.coverDataUrl
      ? await uploadDataUrl(userId, data.coverDataUrl)
      : null;

    const { data: post, error: insErr } = await supabaseAdmin
      .from("posts")
      .insert({
        author_id: userId,
        post_type: "past_question",
        title: data.title,
        body: data.body,
        course_id: data.courseId,
        image_url,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    return { id: post.id, image_url };
  });
