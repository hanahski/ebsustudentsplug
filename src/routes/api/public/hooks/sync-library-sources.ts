import { createFileRoute } from "@tanstack/react-router";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const which = new URL(request.url).searchParams.get("source") ?? "all";
  const results: any[] = [];
  const errors: string[] = [];
  try {
    const mod = await import("@/lib/library-multi-sync.server");
    const tasks: Array<[string, () => Promise<any>]> = [];
    if (which === "all" || which === "gutenberg") tasks.push(["gutenberg", () => mod.syncGutenberg()]);
    if (which === "all" || which === "otl") tasks.push(["otl", () => mod.syncOpenTextbookLibrary()]);
    if (which === "all" || which === "libretexts") tasks.push(["libretexts", () => mod.syncLibreTexts()]);
    if (which === "all" || which === "bccampus") tasks.push(["bccampus", () => mod.syncBCcampus()]);
    if (which === "all" || which === "openstax") {
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
    return Response.json({ ok: true, results, errors });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-library-sources")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
