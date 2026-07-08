// Admin-only: probe the AI Bank health endpoint and return status of all sources.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BankSource = {
  label: string;
  enabled: boolean;
  ok: boolean;
  status: number;
  latency_ms: number | null;
  last_ok_at: string | null;
  cooldown_until: string | null;
  last_error: string | null;
};

async function requireAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase
    .from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("admin only");
}

export const aiBankStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const url = process.env.AI_BANK_URL;
    const key = process.env.AI_BANK_KEY;
    if (!url || !key) throw new Error("AI Bank not configured");
    const started = Date.now();
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/public/health`, {
      method: "GET",
      headers: { "X-Bank-Key": key },
    });
    if (!res.ok) throw new Error(`bank health ${res.status}`);
    const sources = (await res.json()) as BankSource[];
    return {
      sources,
      probedAt: new Date().toISOString(),
      roundTripMs: Date.now() - started,
    };
  });
