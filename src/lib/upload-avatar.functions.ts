import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  base64: z.string().min(10),
  contentType: z.string().default("image/jpeg"),
  ext: z.string().default("jpg"),
});

/**
 * Upload a profile picture using the admin client so RLS on storage.objects
 * can't block signed-in users whose client session is momentarily stale.
 * The bearer token is still validated by `requireSupabaseAuth`, so only the
 * authenticated user can upload to their own folder.
 */
export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const safeExt = data.ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${safeExt}`;
    const up = await supabaseAdmin.storage
      .from("covers")
      .upload(path, bytes, { contentType: data.contentType || "image/jpeg", upsert: true });
    if (up.error) throw new Error(up.error.message);

    const signed = await supabaseAdmin.storage
      .from("covers")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (signed.error) throw new Error(signed.error.message);

    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_key: signed.data.signedUrl })
      .eq("id", userId);
    if (pErr) throw new Error(pErr.message);

    return { url: signed.data.signedUrl };
  });
