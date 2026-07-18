# Verified Sources & Approval Flow for EBSU News

Turn EBSU News into a real multi-contributor pipeline: admin-approved sources can submit posts, everything lands in a pending queue by default, trusted sources auto-publish, and a legit badge shows next to their name everywhere their posts appear.

## What changes for each role

**You (admin)**
- New "Sources" section in the admin panel: list all users, flip `is_verified_source` on/off, set `source_name` (e.g. "FEESSA Press"), toggle `is_trusted_source`.
- New "Pending posts" queue: see every submission with title/body/image/author, one-tap Approve or Reject with an optional reason.
- Existing composer keeps working — your posts always publish instantly.

**Verified source (contributor)**
- Sees a "Post EBSU News" FAB only if you flipped their `is_verified_source`.
- Simple composer: title, body, cover image, tag/category.
- Their post saves as `pending`. They get a toast "Submitted for review".
- If you also gave them `is_trusted_source`, submission publishes straight through.

**Regular users**
- No composer button. Nothing changes for them beyond seeing the legit shield badge next to a source's name on their published articles.

## Data model (one migration)

Add to `profiles`:
- `is_verified_source boolean default false`
- `is_trusted_source boolean default false`
- `source_name text` (optional display name like "FEESSA Press")

Reuse `news_articles` — it already has a `status` column. Extend the allowed values:
- `pending` — awaiting review (default for verified sources)
- `published` — live on the site
- `rejected` — with `rejection_reason text` (new column) shown back to the author

Add small columns to `news_articles`:
- `submitted_by uuid` (author, distinct from admin who published)
- `reviewed_by uuid`, `reviewed_at timestamptz`, `rejection_reason text`

RLS updates:
- Public feed query already filters `status = 'published'` — keep it.
- Verified sources can `INSERT` into `news_articles` with `status = 'pending'` and `submitted_by = auth.uid()`.
- Verified sources can `SELECT` their own submissions (any status) to see review state.
- Only admins can `UPDATE` status/rejection.
- Trusted sources: a `BEFORE INSERT` trigger auto-flips their row to `status = 'published'`, sets `published_at = now()`.

## Server functions

Extend `src/lib/ebsu-manual-post.functions.ts`:
- `canPostEbsuNews` — already exists; add `isTrusted` and `sourceName` to the response so the composer can show "Auto-publishing" vs "Submits for review".
- `publishManualEbsuPost` — if caller is admin, publish directly (today's behavior). If caller is a verified source, force `status = 'pending'` (trusted trigger handles auto-publish). Return `{ status }` so the UI shows the right toast.
- `listPendingSubmissions` (admin) — pending queue with author profile joined.
- `reviewSubmission` (admin) — `{ id, decision: 'approve'|'reject', reason? }`.
- `adminSetSourceFlags` (admin) — `{ userId, isVerifiedSource, isTrustedSource, sourceName }`.
- `listVerifiedSources` (admin) — for the sources tab.

## UI work

1. **Composer (`src/components/EbsuNewsComposer.tsx`)**
   - Keep the friendly 3-step flow.
   - If `isAdmin`: unchanged ("Publish" goes live).
   - If verified non-admin: button reads "Submit for review"; success screen says "Submitted — you'll see it live once approved". If trusted, button reads "Publish" and success links to the live URL.

2. **Legit badge on articles (`src/routes/news.tsx`, `src/routes/news_.$slug.tsx`)**
   - Join `profiles` on `submitted_by`; render a small emerald shield + `source_name` (fallback: display_name) next to the byline when `is_verified_source` is true.
   - Reuse the existing shield style used on the FEESSA TV logo.

3. **Author dashboard strip on `/news`**
   - If the viewer is a verified source, show a small "Your submissions" card above the feed listing their last 5 posts with status pill (Pending / Live / Rejected + reason). Rejected posts show the reason inline.

4. **Admin panel (`src/components/admin/EbsuNewsPanel.tsx`)**
   - Add two new sections above the existing composer/sources block:
     - **Pending review** — cards with cover, title, body preview, author + source name, Approve / Reject buttons (reject opens a small reason prompt).
     - **Verified sources** — searchable user list; each row has toggles for `Verified` and `Trusted`, plus an inline input for `source_name`.

## Rollout order

1. Migration (columns, trigger, RLS, GRANT).
2. Server functions.
3. Admin panel (sources + pending queue) — you can start onboarding contributors immediately.
4. Composer branching (submit vs publish) + submissions strip on `/news`.
5. Legit badge on article cards and article detail page.

## Notes

- Existing `is_legit` stays as a separate personal badge; `is_verified_source` is the new gate for posting EBSU News. Someone can be one, both, or neither.
- The FAB visibility rule becomes: `isAdmin || is_verified_source` (today it's `isAdmin || is_legit`).
- No breaking changes to already-published articles — they stay `published` and render exactly as today.
