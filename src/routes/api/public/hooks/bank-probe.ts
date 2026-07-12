// TEMP diagnostic — probes AI Bank health. Remove after use.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/bank-probe")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.AI_BANK_URL;
        const key = process.env.AI_BANK_KEY;
        if (!url || !key) return Response.json({ ok: false, error: "not_configured", hasUrl: !!url, hasKey: !!key });
        const base = url.replace(/\/+$/, "");
        const results: Record<string, unknown> = { base: base.replace(/^https?:\/\/([^/]+).*/, "$1") };
        try {
          const t0 = Date.now();
          const h = await fetch(`${base}/api/public/health`, { headers: { "X-Bank-Key": key } });
          const hText = await h.text();
          results.health = { status: h.status, ms: Date.now() - t0, body: hText.slice(0, 800) };
        } catch (e) {
          results.healthError = String(e);
        }
        try {
          const t0 = Date.now();
          const c = await fetch(`${base}/api/public/bank`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Bank-Key": key },
            body: JSON.stringify({ kind: "chat", model: "google/gemini-3-flash-preview", messages: [{ role: "user", content: "say hi" }] }),
          });
          const cText = await c.text();
          results.chat = { status: c.status, ms: Date.now() - t0, body: cText.slice(0, 800) };
        } catch (e) {
          results.chatError = String(e);
        }
        return Response.json(results);
      },
    },
  },
});
