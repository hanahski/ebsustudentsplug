// Server-only read client for PUBLIC content used during SSR.
//
// Why this exists: SSR readers used to import the service-role admin client,
// which THROWS when SUPABASE_SERVICE_ROLE_KEY is absent from the runtime env
// (e.g. when the site is served through an external host/proxy deployment).
// A throw inside a route loader turns the whole page into a 500. Public reads
// don't need service role, so we fall back to the publishable (anon) key and
// keep the page rendering.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = ReturnType<typeof createClient<Database>>;

let cached: Client | undefined;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function makeFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Returns a Supabase client suitable for reading public content on the server.
 * Prefers the service-role key when available; otherwise uses the publishable
 * key (RLS applies). Never throws.
 */
export async function getPublicReadClient(): Promise<Client> {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    cached = supabaseAdmin as unknown as Client;
    return cached;
  }

  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !publishable) {
    throw new Error("Supabase URL/key unavailable for public server reads");
  }

  console.warn("[supabase] service role key unavailable — public reads use the publishable key");

  cached = createClient<Database>(url, publishable, {
    global: { fetch: makeFetch(publishable) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
