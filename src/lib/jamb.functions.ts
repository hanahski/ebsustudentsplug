import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const JAMB_REGEX = /^[0-9]{8}[A-Z]{2}$/;

function normalize(raw: string) {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * Public: check whether a JAMB number is already claimed by ANY account.
 * Used on the signup form before creating the auth user. Reads from the
 * `jamb_availability` view which only exposes normalized JAMB values (never
 * the owning profile row).
 */
export const checkJambAvailable = createServerFn({ method: "POST" })
  .inputValidator((input: { jamb: string }) => z.object({ jamb: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const norm = normalize(data.jamb);
    if (!JAMB_REGEX.test(norm)) {
      return { ok: false as const, reason: "invalid" as const };
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supa
      .from("jamb_availability")
      .select("jamb")
      .eq("jamb", norm)
      .limit(1);
    if (error) throw new Error(error.message);
    return { ok: true as const, available: (rows?.length ?? 0) === 0, jamb: norm };
  });

/**
 * Authenticated: attach a JAMB number to the signed-in user's profile.
 * Idempotent (silently succeeds if the same value is already set).
 * Backed by the `claim_jamb_number` DB function which enforces:
 *   - format validation
 *   - global uniqueness
 *   - immutability (once set, never changes)
 */
export const claimJambNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jamb: string }) => z.object({ jamb: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const norm = normalize(data.jamb);
    if (!JAMB_REGEX.test(norm)) throw new Error("Invalid JAMB format (expected 8 digits + 2 letters)");
    // If profile already has this exact JAMB, nothing to do.
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("jamb_number")
      .eq("id", context.userId)
      .maybeSingle();
    if (prof?.jamb_number && normalize(prof.jamb_number) === norm) {
      return { ok: true, jamb: norm, alreadySet: true };
    }
    const { data: result, error } = await context.supabase.rpc("claim_jamb_number", { _jamb: norm });
    if (error) throw new Error(error.message);
    return { ok: true, jamb: norm, alreadySet: false, result };
  });

/** Authenticated: read the caller's current JAMB (null if not yet set). */
export const getMyJamb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("jamb_number")
      .eq("id", context.userId)
      .maybeSingle();
    return { jamb: (data?.jamb_number as string | null) ?? null };
  });
