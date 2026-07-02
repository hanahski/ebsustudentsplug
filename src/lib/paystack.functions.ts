import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYSTACK_BASE = "https://api.paystack.co";

async function paystackKey(): Promise<string> {
  const { readPlatformSetting } = await import("./platform-settings.server");
  const key = await readPlatformSetting("PAYSTACK_SECRET_KEY");
  if (!key) throw new Error("Paystack not configured — ask an admin to add the API key in the admin panel.");
  return key;
}

// Public: list of Nigerian banks (cached in memory per Worker cold start ~15min)
let banksCache: { at: number; data: Array<{ name: string; code: string; slug?: string }> } | null = null;
export const listBanks = createServerFn({ method: "GET" }).handler(async () => {
  if (banksCache && Date.now() - banksCache.at < 15 * 60 * 1000) return banksCache.data;
  const key = await paystackKey();
  const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&perPage=200`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error("Failed to load banks");
  const body: any = await res.json();
  const banks: Array<{ name: string; code: string; slug?: string }> = (body?.data ?? []).map((b: any) => ({
    name: b.name,
    code: b.code,
    slug: b.slug,
  }));
  banksCache = { at: Date.now(), data: banks };
  return banks;
});

/**
 * Opay-style universal resolver.
 * Given a 10-digit account number, try every bank's resolve endpoint in parallel
 * (throttled) and return every bank that recognises the number.
 * - If exactly 1 match → auto-pick.
 * - If multiple → let the user choose which bank they meant.
 */
export const resolveAccountUniversal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { account_number: string }) =>
    z.object({ account_number: z.string().regex(/^\d{10}$/, "10 digits") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const account = data.account_number;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Serve from cache when possible
    const { data: cached } = await supabaseAdmin
      .from("bank_account_resolutions")
      .select("bank_code, bank_name, account_name")
      .eq("account_number", account);
    if (cached && cached.length > 0) {
      return {
        matches: cached.map((r: any) => ({
          bank_code: r.bank_code,
          bank_name: r.bank_name,
          account_name: r.account_name,
        })),
        from_cache: true,
      };
    }

    const key = await paystackKey();
    // Load the full bank list
    if (!banksCache || Date.now() - banksCache.at > 15 * 60 * 1000) {
      const res = await fetch(`${PAYSTACK_BASE}/bank?country=nigeria&perPage=200`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const body: any = await res.json();
      banksCache = {
        at: Date.now(),
        data: (body?.data ?? []).map((b: any) => ({ name: b.name, code: b.code, slug: b.slug })),
      };
    }
    const banks = banksCache!.data;

    const matches: Array<{ bank_code: string; bank_name: string; account_name: string }> = [];

    // Throttle: 12 concurrent requests
    const queue = [...banks];
    const runners = Array.from({ length: 12 }, async () => {
      while (queue.length) {
        const bank = queue.shift();
        if (!bank) return;
        try {
          const url = `${PAYSTACK_BASE}/bank/resolve?account_number=${account}&bank_code=${bank.code}`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
          if (!r.ok) continue;
          const j: any = await r.json();
          if (j?.status && j?.data?.account_name) {
            matches.push({
              bank_code: bank.code,
              bank_name: bank.name,
              account_name: String(j.data.account_name),
            });
          }
        } catch {
          // ignore per-bank failure
        }
      }
    });
    await Promise.all(runners);

    // Cache successful resolutions
    if (matches.length) {
      await supabaseAdmin.from("bank_account_resolutions").upsert(
        matches.map((m) => ({
          account_number: account,
          bank_code: m.bank_code,
          bank_name: m.bank_name,
          account_name: m.account_name,
        })),
        { onConflict: "account_number,bank_code" },
      );
    }

    // touch userId to satisfy linter
    void context.userId;
    return { matches, from_cache: false };
  });
