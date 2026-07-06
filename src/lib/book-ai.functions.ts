import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_KEYS, googleChat, googleImage } from "./google-ai";

// ---------- Book cover & inline illustrations (BOOK_IMAGE_AI_KEY) ----------

export const bookAiCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = input as { title?: string; description?: string; style?: string };
    const title = String(d.title ?? "").slice(0, 200).trim();
    if (!title) throw new Error("title required");
    return {
      title,
      description: String(d.description ?? "").slice(0, 600),
      style: String(d.style ?? "cinematic, moody, book-cover art"),
    };
  })
  .handler(async ({ data }) => {
    const apiKey = AI_KEYS.bookImage();
    if (!apiKey) throw new Error("BOOK_IMAGE_AI_KEY missing");
    const prompt = `Professional book cover art. Title: "${data.title}". ${data.description ? `Story: ${data.description}. ` : ""}Style: ${data.style}. Vertical 2:3 poster composition, dramatic lighting, no lettering, no watermark, no text.`;
    const img = await googleImage({ apiKey, prompt });
    if (!img) throw new Error("No image returned");
    return { dataUrl: `data:${img.mimeType};base64,${img.base64}` };
  });

export const bookAiInlineImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = input as { prompt?: string; style?: string };
    const prompt = String(d.prompt ?? "").slice(0, 600).trim();
    if (!prompt) throw new Error("prompt required");
    return { prompt, style: String(d.style ?? "cinematic illustration, painterly, richly detailed") };
  })
  .handler(async ({ data }) => {
    const apiKey = AI_KEYS.bookImage();
    if (!apiKey) throw new Error("BOOK_IMAGE_AI_KEY missing");
    const prompt = `${data.prompt}. Style: ${data.style}. Landscape 16:9 illustration for a book chapter. No text, no watermarks, no logos.`;
    const img = await googleImage({ apiKey, prompt });
    if (!img) throw new Error("No image returned");
    return { dataUrl: `data:${img.mimeType};base64,${img.base64}` };
  });

// ---------- Book AI writing assist (TOOLS_AI_KEY) ----------

type Mode = "continue" | "rewrite" | "expand" | "shorten" | "grammar";

const PROMPTS: Record<Mode, string> = {
  continue:
    "You are a novelist ghost-writer. Continue the passage below in the same voice, tense, and POV for roughly one paragraph. Return ONLY the new prose to append — no preamble, no quotes, no markdown headings.",
  rewrite:
    "You are a line editor. Rewrite the passage below for clarity, rhythm, and vivid word choice while preserving meaning, POV, and tense. Return ONLY the rewritten passage — no preamble.",
  expand:
    "You are a novelist. Expand the passage below with sensory detail, beats, and dialogue where natural — roughly double the length. Keep voice, POV, and tense. Return ONLY the expanded passage.",
  shorten:
    "You are a ruthless editor. Compress the passage below to about half the length while keeping every essential beat and the author's voice. Return ONLY the tightened passage.",
  grammar:
    "You are a proofreader. Fix grammar, punctuation, spelling, and awkward phrasing in the passage below. Do NOT change the meaning, voice, or style. Return ONLY the corrected passage.",
};

export const bookAiAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const d = input as { mode?: string; text?: string; context?: string };
    const mode = String(d.mode ?? "") as Mode;
    if (!PROMPTS[mode]) throw new Error("bad mode");
    const text = String(d.text ?? "").slice(0, 8000);
    if (!text.trim()) throw new Error("empty passage");
    const context = String(d.context ?? "").slice(0, 2000);
    return { mode, text, context };
  })
  .handler(async ({ data }) => {
    const apiKey = AI_KEYS.tools();
    if (!apiKey) throw new Error("TOOLS_AI_KEY missing");

    const system = data.context
      ? `${PROMPTS[data.mode]}\n\nBook context (for tone reference only, do not repeat):\n${data.context}`
      : PROMPTS[data.mode];

    const output = await googleChat({
      apiKey,
      model: "gemini-2.5-flash",
      system,
      messages: [{ role: "user", content: data.text }],
    });
    return { output: output.trim() };
  });
