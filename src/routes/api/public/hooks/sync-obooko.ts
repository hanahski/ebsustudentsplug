import { createFileRoute } from "@tanstack/react-router";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { syncObooko } = await import("@/lib/obooko-sync.server");
    const raw = new URL(request.url).searchParams.get("pages");
    const pages = raw ? Math.max(1, Math.min(200, Number.parseInt(raw, 10) || 60)) : 60;
    const result = await syncObooko(pages);
    return Response.json({ ok: true, result });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-obooko")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
