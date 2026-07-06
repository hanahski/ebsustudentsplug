// AI calls are routed through the AI Bank (a separate Lovable project that
// fronts a pool of AI proxy sources and fails over automatically).
//
// The public API of this module is unchanged so existing callers keep working:
//   - googleChat({ apiKey, model, system, messages, json })
//   - googleImage({ apiKey, prompt, refImages, model })
//   - AI_KEYS.{tools,bookImage,plug,news}()
//
// The `apiKey` argument is ignored — auth happens via AI_BANK_KEY on the server.

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type Part = TextPart | ImagePart;
export type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string | Part[];
};

function bankConfig() {
  const url = process.env.AI_BANK_URL;
  const key = process.env.AI_BANK_KEY;
  if (!url || !key) throw new Error("AI Bank not configured (AI_BANK_URL/AI_BANK_KEY)");
  return { url: url.replace(/\/+$/, ""), key };
}

function errorFor(status: number, body: string): Error {
  if (status === 429) return new Error("AI is busy — try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted.");
  if (status === 401 || status === 403)
    return new Error(`AI Bank rejected the request (${status}).`);
  if (status === 503) return new Error("All AI sources are down. Try again shortly.");
  return new Error(`AI Bank error ${status}: ${body.slice(0, 200)}`);
}

async function callBank(payload: Record<string, unknown>): Promise<any> {
  const { url, key } = bankConfig();
  const res = await fetch(`${url}/api/public/bank`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bank-Key": key,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw errorFor(res.status, await res.text().catch(() => ""));
  return res.json();
}

export async function googleChat(opts: {
  apiKey?: string;
  model?: string;
  system?: string;
  messages: ChatMsg[];
  json?: boolean;
}): Promise<string> {
  const model = opts.model ?? "google/gemini-2.5-flash";
  // OpenAI-compatible message shape (Lovable AI Gateway).
  const msgs: Array<{ role: string; content: string | Part[] }> = [];
  if (opts.system) msgs.push({ role: "system", content: opts.system });
  for (const m of opts.messages) msgs.push({ role: m.role, content: m.content });

  const j = await callBank({
    kind: "chat",
    model,
    messages: msgs,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  // Accept either a raw OpenAI response or a normalised { text } shape.
  if (typeof j?.text === "string") return j.text;
  if (typeof j?.reply === "string") return j.reply;
  const content = j?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((p: any) => p?.text ?? "").join("");
  }
  return "";
}

export async function googleImage(opts: {
  apiKey?: string;
  prompt: string;
  refImages?: string[];
  model?: string;
}): Promise<{ base64: string; mimeType: string } | null> {
  const model = opts.model ?? "google/gemini-2.5-flash-image-preview";
  const j = await callBank({
    kind: "image",
    model,
    prompt: opts.prompt,
    ...(opts.refImages && opts.refImages.length
      ? { ref_images: opts.refImages }
      : {}),
  });
  if (j?.base64 && (j.mimeType || j.mime_type)) {
    return { base64: j.base64, mimeType: j.mimeType || j.mime_type };
  }
  // Fallback: OpenAI-style image response with data URL.
  const url = j?.data?.[0]?.url || j?.url;
  if (typeof url === "string") {
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (m) return { mimeType: m[1], base64: m[2] };
  }
  return null;
}

/**
 * Back-compat shim — every group now routes through the AI Bank, so the
 * returned "key" is just the bank key. Callers only check truthiness.
 */
export const AI_KEYS = {
  tools: () => process.env.AI_BANK_KEY || "",
  bookImage: () => process.env.AI_BANK_KEY || "",
  plug: () => process.env.AI_BANK_KEY || "",
  news: () => process.env.AI_BANK_KEY || "",
};
