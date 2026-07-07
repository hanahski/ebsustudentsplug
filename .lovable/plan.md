# Plan: Big UI/UX + Plug AI upgrade

This is a large batch of changes. Grouping into 5 workstreams so we ship without breaking anything. I'll match everything to the existing StudentsPlug design tokens (`--primary`, `--accent`, `--background`, `--foreground`, oklch) — no hardcoded colors, no purple gradients.

## 1. Welcome loader (new-user full screen)

- Replace the current pencil/logo loader inside `src/components/BrandLoader.tsx` (the one shown in the new-user welcome overlay) with the Uiverse pencil SVG you provided.
- Rework it so `currentColor` and the hardcoded `hsl(223,90%,50%)` values map to our semantic tokens (`text-primary`, `--primary`, `--accent`) — keeps it on-brand in light + dark mode.
- Keep the surrounding shell (aura, wordmark shimmer, "preparing your workspace" caption) so it still feels like StudentsPlug, not a generic Uiverse widget.
- Keep `prefers-reduced-motion` support.

## 2. Plug AI upgrade (smarter + more "alive" UX)

Backend / brains:
- Widen the Plug AI system prompt so it's genuinely general-purpose (math, coding, life advice, science, casual chat) while still knowing it's StudentsPlug and preferring school-relevant answers when the question is school-shaped.
- Keep the AI Bank auto-switch behavior untouched.

Chat UI (`src/routes/chat.tsx` + related):
- New Plug AI avatar/logo (generated image, not Sparkles) — soft glowing orb that reads as "AI".
- Chat background: subtle animated aura using our tokens (radial gradient + slow drift) so it feels ambient, not busy.
- Message typography bumped for readability; assistant messages sit on the page (no bubble), user messages get a high-contrast `primary` bubble.
- Replace the "typing…" indicator with the Uiverse `Generating…` loader (letters + spinning ring), retinted to our palette.
- Sounds: replace/augment the existing send/receive tick with a short futuristic low-bass "whoosh" (WebAudio-generated so no new asset needed). Keeps user's existing sound-off preference.
- Aura on the composer: soft glowing ring around the prompt input while the AI is thinking.

## 3. Theme toggle

- Swap the current `ThemeToggle` for the Uiverse animated sun/moon switch.
- Wire the checkbox to the existing `next-themes` (or current theme hook) so nothing else changes — only the visual control.
- Keep accessibility: real `<label>`+`<input type="checkbox">`, `aria-label`, keyboard toggle.

## 4. Book composer + reader UI/UX

Composer (`books_.composer.*`):
- Nicer section cards, refined toolbar, better empty states.
- Writer "loading → written" state uses the Uiverse typewriter animation while the AI is generating a chapter.
- Better primary Download button (icon + subtle gradient using our tokens, hover lift, progress state during export).

Composer Book Viewer (Read vs Download):
- Detect file type from extension + mimetype.
- **PDF** → "Read" opens the existing in-app `PdfReader` (already uses pdf.js). Fix the current fallback that downloads instead of opening.
- **EPUB** → install `epubjs` + `react-reader`, open in a full-screen reader modal with chapter nav; persist last location in `localStorage` under `epub-loc:{bookId}` (and to Supabase profile row if we already track reading progress).
- **MOBI / AZW / AZW3 / KFX** → hide/disable "Read". Show only "Download" with helper text: *"Open with the free Kindle app (iOS/Android/desktop) or send to your Kindle device."*
- Download button behavior unchanged for every format.

## 5. Small polish

- New loader letters component (`GeneratingLoader`) reusable anywhere we currently show "Loading…" for AI output.
- Audit book reader/composer for hardcoded colors and route them through tokens.

## Technical notes

- New deps: `epubjs`, `react-reader` (installed with `bun add`).
- New files: `src/components/ui/GeneratingLoader.tsx`, `src/components/ui/ThemeSwitch.tsx`, `src/components/ui/TypewriterLoader.tsx`, `src/components/EpubReader.tsx`, new Plug AI avatar asset.
- Edited: `BrandLoader.tsx`, `ThemeToggle.tsx`, `chat.tsx`, `books_.composer.*`, composer viewer component, Plug AI system prompt in `plug-ai.ts` / `google-ai.ts`.
- No DB schema changes required (localStorage is enough for reading position; optional Supabase column can come later if you want cross-device sync).
- Every Uiverse snippet re-tinted to semantic tokens; no `text-white`/`bg-[#hex]` in components.

## What I need from you

1. **Scope confirm** — ship all 5 workstreams in one go, or start with #1 + #4 (loaders + Read/Download fix) and do Plug AI polish in a second pass?
2. **Cross-device reading progress for EPUB** — localStorage only (fast, no schema change), or add a `reading_progress` table now?
3. **Plug AI "sound with bass"** — WebAudio-generated (no asset, ships now) or should I generate a real short mp3 asset for a richer sound?
