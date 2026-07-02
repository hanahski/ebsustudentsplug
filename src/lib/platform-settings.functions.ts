import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY_ALLOWLIST = [
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "NEWS_API_KEY",
] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

// Admin-only: list keys and whether each is configured (never returns the value)
export const listPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("platform_settings")
      .select("key, is_secret, updated_at, value");
    const map = new Map((data ?? []).map((r: any) => [r.key, r]));
    return KEY_ALLOWLIST.map((k) => {
      const row: any = map.get(k);
      const isPublic = k.endsWith("PUBLIC_KEY");
      return {
        key: k,
        configured: !!row?.value,
        is_secret: !isPublic,
        // Only expose the raw value for non-secret (public) keys.
        value: isPublic ? row?.value ?? null : null,
        preview: row?.value ? `${row.value.slice(0, 4)}••••${row.value.slice(-4)}` : null,
        updated_at: row?.updated_at ?? null,
      };
    });
  });

export const upsertPlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: string }) =>
    z
      .object({
        key: z.enum(KEY_ALLOWLIST),
        value: z.string().min(4).max(4096),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isPublic = data.key.endsWith("PUBLIC_KEY");
    const { error } = await supabaseAdmin.from("platform_settings").upsert({
      key: data.key,
      value: data.value.trim(),
      is_secret: !isPublic,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) =>
    z.object({ key: z.enum(KEY_ALLOWLIST) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("platform_settings").delete().eq("key", data.key);
    return { ok: true };
  });

// Public: returns the Paystack PUBLIC key only (safe to expose)
export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "PAYSTACK_PUBLIC_KEY")
    .maybeSingle();
  return { publicKey: data?.value ?? null };
});
