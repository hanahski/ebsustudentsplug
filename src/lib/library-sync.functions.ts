import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Admin-only trigger for library catalog sync (OpenStax + new sources).
export const runLibrarySync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        source: z
          .enum(["all", "openstax", "gutenberg", "otl", "libretexts", "bccampus"])
          .default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const results: any[] = [];
    const errors: string[] = [];
    const mod = await import("@/lib/library-multi-sync.server");
    const tasks: Array<[string, () => Promise<any>]> = [];
    if (data.source === "all" || data.source === "gutenberg")
      tasks.push(["gutenberg", () => mod.syncGutenberg()]);
    if (data.source === "all" || data.source === "otl")
      tasks.push(["otl", () => mod.syncOpenTextbookLibrary()]);
    if (data.source === "all" || data.source === "libretexts")
      tasks.push(["libretexts", () => mod.syncLibreTexts()]);
    if (data.source === "all" || data.source === "bccampus")
      tasks.push(["bccampus", () => mod.syncBCcampus()]);
    if (data.source === "all" || data.source === "openstax") {
      const { syncOpenStax } = await import("@/lib/openstax-sync.server");
      tasks.push(["openstax", () => syncOpenStax()]);
    }
    for (const [name, task] of tasks) {
      try {
        results.push({ name, ...(await task()) });
      } catch (e) {
        errors.push(`${name}: ${(e as Error).message}`);
      }
    }
    return { ok: true, results, errors };
  });
