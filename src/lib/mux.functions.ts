import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MUX_BASE = "https://api.mux.com";

async function muxAuth(): Promise<string> {
  const { readPlatformSetting } = await import("./platform-settings.server");
  const id = await readPlatformSetting("MUX_TOKEN_ID");
  const secret = await readPlatformSetting("MUX_TOKEN_SECRET");
  if (!id || !secret) {
    throw new Error("Mux is not configured — ask an admin to add MUX_TOKEN_ID and MUX_TOKEN_SECRET in the admin panel.");
  }
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

/** Admin-only: get a direct upload URL for a banner video. */
export const createMuxBannerUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const auth = await muxAuth();
    const res = await fetch(`${MUX_BASE}/video/v1/uploads`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
          encoding_tier: "smart",
          video_quality: "basic",
        },
      }),
    });
    if (!res.ok) throw new Error(`Mux upload create failed: ${res.status}`);
    const j: any = await res.json();
    return {
      upload_id: j.data.id as string,
      url: j.data.url as string,
    };
  });

/** Poll a direct upload → asset → playback_id. */
export const getMuxUploadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { upload_id: string }) =>
    z.object({ upload_id: z.string().min(4) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const auth = await muxAuth();
    const up = await fetch(`${MUX_BASE}/video/v1/uploads/${data.upload_id}`, {
      headers: { Authorization: auth },
    });
    if (!up.ok) throw new Error(`Mux upload status failed: ${up.status}`);
    const uploadBody: any = await up.json();
    const assetId: string | null = uploadBody?.data?.asset_id ?? null;
    if (!assetId) {
      return { status: uploadBody?.data?.status ?? "waiting", asset_id: null, playback_id: null };
    }
    const asset = await fetch(`${MUX_BASE}/video/v1/assets/${assetId}`, {
      headers: { Authorization: auth },
    });
    const assetBody: any = await asset.json();
    const playbackId = assetBody?.data?.playback_ids?.[0]?.id ?? null;
    return {
      status: assetBody?.data?.status ?? "preparing",
      asset_id: assetId,
      playback_id: playbackId,
    };
  });
