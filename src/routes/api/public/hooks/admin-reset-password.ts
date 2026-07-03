// One-shot admin password reset. Guarded by CRON_SECRET.
// POST { email, password } with Authorization: Bearer <CRON_SECRET>
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/admin-reset-password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const { email, password } = (await request.json()) as { email?: string; password?: string };
        if (!email || !password || password.length < 8) {
          return Response.json({ ok: false, error: "bad_input" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        if (listErr) return Response.json({ ok: false, error: listErr.message }, { status: 500 });
        const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!user) return Response.json({ ok: false, error: "user_not_found" }, { status: 404 });
        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
