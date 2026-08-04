import { createFileRoute } from "@tanstack/react-router";
import { requireCronOrAdmin } from "@/lib/cron-auth.server";

async function run(request: Request) {
  const denied = await requireCronOrAdmin(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(600, Number.parseInt(url.searchParams.get("limit") ?? "300", 10) || 300));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveObookoFormatsBatch } = await import("@/lib/obooko-formats.server");

    const { data, error } = await supabaseAdmin
      .from("library_books")
      .select("id,source_url")
      .eq("source", "obooko")
      .is("download_url", null)
      .not("source_url", "is", null)
      .limit(limit);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<{ id: string; source_url: string }>;
    const resolved = await resolveObookoFormatsBatch(rows, 12);

    let updated = 0;
    let unresolved = 0;
    for (const row of rows) {
      const formats = resolved.get(row.source_url) ?? {};
      const primary = formats.pdf ?? formats.epub ?? null;
      if (!primary) {
        unresolved += 1;
        continue;
      }
      const { error: upErr } = await supabaseAdmin
        .from("library_books")
        .update({ download_url: primary, download_formats: formats, read_url: primary })
        .eq("id", row.id);
      if (!upErr) updated += 1;
    }

    const { count: remaining } = await supabaseAdmin
      .from("library_books")
      .select("id", { count: "exact", head: true })
      .eq("source", "obooko")
      .is("download_url", null);

    return Response.json({ ok: true, scanned: rows.length, updated, unresolved, remaining });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/backfill-obooko-formats")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
