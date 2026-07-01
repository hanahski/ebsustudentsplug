import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const messages = [
      { role: "system" as const, content: PROMPTS[data.mode] },
      ...(data.context
        ? [{ role: "system" as const, content: `Book context (for tone reference only, do not repeat):\n${data.context}` }]
        : []),
      { role: "user" as const, content: data.text },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });
    if (res.status === 429) throw new Error("AI is busy — try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const output: string = json?.choices?.[0]?.message?.content ?? "";
    return { output: output.trim() };
  });
