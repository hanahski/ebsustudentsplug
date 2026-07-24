// Admin actions on tickets — hard delete + wipe related rows.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const adminDeleteTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string }) =>
    z.object({ ticketId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Wipe dependents first (best-effort)
    await supabaseAdmin.from("ticket_scans").delete().eq("ticket_id", data.ticketId);
    await supabaseAdmin.from("ticket_share_links").delete().eq("ticket_id", data.ticketId);
    await supabaseAdmin.from("ticket_purchases").delete().eq("ticket_id", data.ticketId);
    const { error } = await supabaseAdmin.from("tickets").delete().eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
