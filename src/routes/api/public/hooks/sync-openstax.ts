import { createFileRoute } from "@tanstack/react-router";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function syncResponse(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { syncOpenStax } = await import("@/lib/openstax-sync.server");
    const results = await syncOpenStax();
    return Response.json({ ok: true, source: "openstax.org", results });
  } catch (error) {
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-openstax")({
  server: {
    handlers: {
      GET: ({ request }) => syncResponse(request),
      POST: ({ request }) => syncResponse(request),
    },
  },
});
