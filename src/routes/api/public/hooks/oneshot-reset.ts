// TEMPORARY one-shot: resets both seed admin passwords. Delete after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/oneshot-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.ONESHOT_ADMIN_RESET;
        if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const { password } = (await request.json()) as { password?: string };
        if (!password || password.length < 8) {
          return Response.json({ ok: false, error: "bad_input" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const emails = ["consequenceoct@gmail.com", "admin+qx162n@ebsuplug.app"];
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 });
        if (listErr) return Response.json({ ok: false, error: listErr.message }, { status: 500 });
        const results: Record<string, string> = {};
        for (const em of emails) {
          const u = list.users.find((x) => x.email?.toLowerCase() === em.toLowerCase());
          if (!u) { results[em] = "not_found"; continue; }
          const { error } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
            password,
            email_confirm: true,
          });
          results[em] = error ? `err:${error.message}` : "ok";
        }
        return Response.json({ ok: true, results });
      },
    },
  },
});
