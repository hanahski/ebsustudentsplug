// Grant / revoke the admin role. Runs server-side with the admin client because
// user_roles has no client-side INSERT/DELETE policy (a client delete silently
// affects 0 rows, which looked like "revoke admin doesn't work").
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; value: boolean }) =>
    z.object({ userId: z.string().uuid(), value: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Caller must be an admin (checked as the caller, RLS-scoped).
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.value) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
      return { ok: true, isAdmin: true };
    }

    // Don't allow removing the last admin — that would lock everyone out.
    const { data: admins, error: listErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (listErr) throw new Error(listErr.message);
    const others = (admins ?? []).filter((r) => r.user_id !== data.userId);
    if (others.length === 0) throw new Error("Can't revoke the last remaining admin.");

    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    // Verify it actually went away.
    const { data: still } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (still) throw new Error("Revoke failed: role still present.");

    return { ok: true, isAdmin: false };
  });
