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

function errorFor(status: number, _body: string): Error {
  if (status === 429)
    return new Error("Hold on a moment — Plug AI is catching its breath. Try again in a few seconds.");
  if (status === 402)
    return new Error("Plug AI is topping up. Please try again shortly.");
  if (status === 401 || status === 403)
    return new Error("Plug AI is reconnecting. Please try again in a moment.");
  if (status === 503)
    return new Error("Plug AI is warming up its brain. Please be patient — models will be back in a few moments.");
  if (status >= 500)
    return new Error("Plug AI hit a small hiccup. Please try again shortly.");
  return new Error("Plug AI couldn't respond just now. Please try again in a moment.");
}


const CHAT_MODEL_ALIASES: Record<string, string> = {
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "gpt-5": "openai/gpt-5",
  "gpt-5-mini": "openai/gpt-5-mini",
  "gpt-5-nano": "openai/gpt-5-nano",
};

function normalizeModel(model: string | undefined, fallback: string) {
  const raw = (model || fallback).trim();
  return CHAT_MODEL_ALIASES[raw] ?? raw;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callBank(payload: Record<string, unknown>): Promise<any> {
  const { url, key } = bankConfig();
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${url}/api/public/bank`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Bank-Key": key,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return res.json();

    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");

    // Retry only transient Bank/proxy failures. Auth, credits, and validation
    // errors should fail fast with the original status.
    if (![429, 500, 502, 503, 504].includes(res.status) || attempt === 2) break;
    await delay(400 * (attempt + 1));
  }

  throw errorFor(lastStatus, lastBody);
}

export async function googleChat(opts: {
  apiKey?: string;
  model?: string;
  system?: string;
  messages: ChatMsg[];
  json?: boolean;
}): Promise<string> {
  const model = normalizeModel(opts.model, "google/gemini-3-flash-preview");
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
  const model = normalizeModel(opts.model, "google/gemini-2.5-flash-image-preview");
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
