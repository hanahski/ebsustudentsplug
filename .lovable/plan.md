
## Scope

Big batch of video + UX fixes. Building it all in one shot would take many hours and risk breaking the feed. Here's a phased plan — I'll implement Phase 1 first, then move to 2 and 3 after you confirm.

## Phase 1 — Video pipeline + player (core of your ask)

Custom video system built from scratch (no Mux).

1. **Upload limits** — enforce ≤5MB **and** ≤10s for feed videos and profile cover videos. Client-side check + trim/reject with clear toast. Applies to post composer, banner uploads, and profile cover.
2. **HLS-lite via cached MP4 + smart preload** — since we're not using Mux, we get "adaptive-ish" behavior by:
   - Storing videos in Supabase Storage with a stable CDN URL.
   - Using `preload="auto"` on the currently visible + next video only.
   - Adding a Service Worker cache (`sw.js`) for `/storage/v1/object/public/**/*.mp4` so a scrolled-past video is instant on re-view and next video is warm before it's visible.
3. **New fancy player UI** (`src/components/VideoPlayer.tsx`) — modeled on the vocal-split polish:
   - Poster frame auto-generated on first `loadedmetadata` (canvas → data URL cached in IndexedDB).
   - Glass controls, animated progress bar with buffered range, tap-to-unmute pill, double-tap seek ±10s, long-press = 2× speed.
   - Loading spinner while `readyState < 3`; skeleton while poster is generating.
   - Muted autoplay when ≥60% visible (IntersectionObserver), pause + release decoder when off-screen.
4. **TikTok-style vertical feed viewer** — tapping any feed video opens `/watch/:postId` full-screen with snap-scroll to prev/next video posts from the same feed context.
5. **Kill lazy image loading site-wide** — remove `loading="lazy"` from `<img>` and `StorageMedia`; keep it only for `<iframe>` embeds.

## Phase 2 — Composer + trimmer

6. **Realtime trim preview** — VideoTrimmer plays the currently-selected range live as you drag handles (loops between start/end without needing "apply").
7. **Book composer / reader desktop layout** — fix overflow at ≥lg breakpoints (sidebar + reader pane grid).
8. **Book reader page flip** — CSS 3D flip animation on swipe + `flip.mp3` (you already uploaded one, I'll wire it in).

## Phase 3 — Banner + polish

9. **Banner responsive on desktop** — fix aspect-ratio so uploaded images fill the desktop hero without letterboxing/cropping oddly.
10. **Profile cover parity** with feed player + 5MB/10s enforcement.

## Technical notes

- Service Worker: registered from `__root.tsx` only in production; cache name versioned so we can bust it.
- Poster generation runs off-main-thread via `requestIdleCallback` when supported.
- `/watch/:id` route reuses feed query cache — no extra fetch when opened from the feed.
- Flip sound: `src/assets/page-flip.mp3` from your upload; preloaded once, played via a single shared `HTMLAudioElement`.

## What I will NOT do

- No Mux (per your instruction).
- No changes to auth, DB schema (Phase 1 is client-only), or unrelated tools.

---

**Confirm and I'll start Phase 1.** Or tell me to reorder / drop items.
