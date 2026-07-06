// Direct Google AI Studio (Gemini) helper.
// Each AI feature group passes its own API key so admins can rotate/scope
// keys independently of the Lovable AI Gateway.
//
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type Part = TextPart | ImagePart;
export type ChatMsg = {
  role: "user" | "assistant" | "system";
  content: string | Part[];
};

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function stripVendor(model: string): string {
  return model.replace(/^google\//, "");
}

function partsFromContent(content: ChatMsg["content"]): any[] {
  if (typeof content === "string") return [{ text: content }];
  return content.map((p) => {
    if (p.type === "text") return { text: p.text };
    const url = p.image_url.url;
    const m = url.match(/^data:([^;]+);base64,(.+)$/);
    if (m) return { inlineData: { mimeType: m[1], data: m[2] } };
    return { fileData: { mimeType: "image/png", fileUri: url } };
  });
}

function errorFor(status: number, body: string): Error {
  if (status === 429) return new Error("AI is busy — try again in a moment.");
  if (status === 402) return new Error("AI credits exhausted.");
  if (status === 401 || status === 403)
    return new Error(`AI key rejected (${status}). Check the API key.`);
  return new Error(`AI error ${status}: ${body.slice(0, 200)}`);
}

export async function googleChat(opts: {
  apiKey: string;
  model?: string;
  system?: string;
  messages: ChatMsg[];
  json?: boolean;
}): Promise<string> {
  if (!opts.apiKey) throw new Error("Missing Google AI key");
  const model = stripVendor(opts.model ?? "gemini-2.5-flash");

  const systemMsgs = opts.messages.filter((m) => m.role === "system");
  const nonSystem = opts.messages.filter((m) => m.role !== "system");
  const sysText = [
    opts.system,
    ...systemMsgs.map((m) => (typeof m.content === "string" ? m.content : "")),
  ]
    .filter(Boolean)
    .join("\n\n");

  const body: any = {
    contents: nonSystem.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: partsFromContent(m.content),
    })),
  };
  if (sysText) body.systemInstruction = { parts: [{ text: sysText }] };
  if (opts.json) body.generationConfig = { responseMimeType: "application/json" };

  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw errorFor(res.status, await res.text().catch(() => ""));
  const j: any = await res.json();
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p?.text ?? "").join("");
}

export async function googleImage(opts: {
  apiKey: string;
  prompt: string;
  refImages?: string[]; // data URLs or http URLs
  model?: string;
}): Promise<{ base64: string; mimeType: string } | null> {
  if (!opts.apiKey) throw new Error("Missing Google AI key");
  const model = stripVendor(opts.model ?? "gemini-2.5-flash-image-preview");

  const parts: any[] = [{ text: opts.prompt }];
  for (const r of opts.refImages ?? []) {
    const m = r.match(/^data:([^;]+);base64,(.+)$/);
    if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    else parts.push({ fileData: { mimeType: "image/png", fileUri: r } });
  }
  const url = `${BASE}/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) throw errorFor(res.status, await res.text().catch(() => ""));
  const j: any = await res.json();
  const outParts = j?.candidates?.[0]?.content?.parts ?? [];
  for (const p of outParts) {
    if (p?.inlineData?.data) {
      return {
        base64: p.inlineData.data,
        mimeType: p.inlineData.mimeType || "image/png",
      };
    }
  }
  return null;
}

/**
 * Key group helpers — read the right env var for each AI feature group.
 * Falls back to LOVABLE_API_KEY so nothing breaks while admins are still
 * rolling out the per-group Google AI Studio keys.
 */
export const AI_KEYS = {
  tools: () => process.env.TOOLS_AI_KEY || process.env.LOVABLE_API_KEY || "",
  bookImage: () => process.env.BOOK_IMAGE_AI_KEY || process.env.LOVABLE_API_KEY || "",
  plug: () => process.env.PLUG_AI_KEY || process.env.LOVABLE_API_KEY || "",
  news: () => process.env.NEWS_AI_KEY || process.env.LOVABLE_API_KEY || "",
};
