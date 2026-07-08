// Guards for /api/public/hooks/* endpoints. Every hook must call one of
// these; without a guard the endpoint is publicly invokable and can burn
// API quotas or trigger admin logic.

export function requireCronSecret(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

/** Accepts either the CRON_SECRET bearer token OR an authenticated admin user. */
export async function requireCronOrAdmin(request: Request): Promise<Response | null> {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return null;

  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userRes.user.id,
    _role: "admin" as never,
  });
  if (!isAdmin) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  return null;
}
