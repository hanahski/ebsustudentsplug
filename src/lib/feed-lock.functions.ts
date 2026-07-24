// Feed lock — admins can lock the main post feed so only admins can post.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LOCK_KEY = "FEED_LOCKED";
const MSG_KEY = "FEED_LOCK_MESSAGE";
const DEFAULT_MSG = "Admin has locked the post feed. Posting is temporarily disabled.";

export const getFeedLock = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", [LOCK_KEY, MSG_KEY]);
  const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
  return {
    locked: (map.get(LOCK_KEY) ?? "") === "1",
    message: (map.get(MSG_KEY) as string) || DEFAULT_MSG,
  };
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const setFeedLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { locked: boolean; message?: string }) =>
    z.object({ locked: z.boolean(), message: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows = [
      { key: LOCK_KEY, value: data.locked ? "1" : "0", is_secret: false, updated_by: context.userId, updated_at: now },
    ];
    if (typeof data.message === "string") {
      rows.push({ key: MSG_KEY, value: data.message.trim() || DEFAULT_MSG, is_secret: false, updated_by: context.userId, updated_at: now });
    }
    const { error } = await supabaseAdmin.from("platform_settings").upsert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
