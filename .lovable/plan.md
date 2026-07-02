
## 1. Obooko novels (link-out only)

Add a scraper that indexes obooko.com's public catalog, storing metadata + cover in `library_books`, with "Read/Download" opening obooko.com in a new tab (no rehosting).

- New server helper `src/lib/obooko-sync.server.ts`:
  - Crawl obooko category index pages (Fiction, Romance, Sci-Fi, Mystery, Thriller, Horror, Fantasy, Children, Non-fiction, Poetry, Short Stories).
  - Per book: extract title, author, description, cover image URL, star rating (e.g. `4.0`), and detail-page URL.
  - Map to `library_books` row:
    - `openlibrary_key = "obooko-<slug>"`
    - `source = "obooko"`, `source_url = detail page`, `read_url = detail page` (link-out)
    - `cover_url = <obooko cover>` (cached later by existing `generate-book-covers` hook if needed)
    - `category = "novel"` (or `poetry`/`comics` when the section matches)
    - `price_credits = rating` stored as numeric (e.g. `4.0`). If rating missing, default `3.0`.
    - `description`, `author` populated from page.
  - Concurrency-limited fetch, upsert in batches of 200.
- New public cron hook `src/routes/api/public/hooks/sync-obooko.ts` (bearer `CRON_SECRET`, GET/POST), calls the sync and returns counts.
- Add "Obooko" to the multi-source sync runner (`sync-library-sources.ts`) so it's included in the nightly job.
- Trigger a one-time import so books show up immediately.
- `price_credits` on `library_books` is already numeric — no schema change needed; existing purchase flow already reads it.

Note: obooko requires a free account to actually download the PDF. Because we're link-out only, users click through and complete the download on obooko; we don't touch their files.

## 2. JAMB registration lock at signup

One JAMB reg number = one account, forever, cannot be reused.

**Schema (migration):**
```sql
ALTER TABLE public.profiles
  ADD COLUMN jamb_number text;

CREATE UNIQUE INDEX profiles_jamb_number_unique
  ON public.profiles (upper(jamb_number))
  WHERE jamb_number IS NOT NULL;

-- Prevent changing/clearing a JAMB number once set
CREATE OR REPLACE FUNCTION public.lock_jamb_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.jamb_number IS NOT NULL
     AND NEW.jamb_number IS DISTINCT FROM OLD.jamb_number THEN
    RAISE EXCEPTION 'JAMB number cannot be changed once set';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_lock_jamb
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_jamb_number();
```

**Signup UX (`src/routes/login.tsx` signup form):**
- Add required "JAMB registration number" field (format: 8 digits + 2 letters, e.g. `20123456AB`) with client-side regex validation.
- Before calling `supabase.auth.signUp`, call a new server fn `checkJambAvailable({ jamb })` that hits `profiles` via server publishable client with a narrow `TO anon` SELECT policy on `jamb_number` only, returning `{ available: boolean }`.
- On successful signup, immediately upsert the JAMB number onto the new user's profile (server fn `claimJambNumber` using `requireSupabaseAuth`). Uniqueness index enforces "cannot be reused"; trigger enforces "cannot be changed".
- Existing users with no JAMB set: on next login, show a one-time modal on `/me` requiring them to claim their JAMB before continuing to use paid actions. (Non-blocking for read-only browsing.)
- Admin `/admin` gets a small "Reset JAMB for user" action that calls a security-definer function (`admin_reset_jamb`) — only path to clear it, gated by `is_admin`.

## 3. Admin-editable News API key

Replace hardcoded/env news key with a `platform_settings` entry the admin can edit live.

- `platform_settings` table already exists. Store key as `news_api_key`.
- Server route `src/routes/api/news.ts` already reads the key — switch it to `readPlatformSetting("news_api_key")` (falls back to `process.env.NEWS_API_KEY` if unset, so nothing breaks during rollout).
- Same swap for `src/routes/api/public/hooks/auto-ebsu-news.ts` and any `ebsu_news_sources` fetch that uses the key.
- Admin panel: add a "News API" card in `src/components/admin/AdminIntegrations.tsx` with:
  - Masked text input showing current value (last 4 chars).
  - "Save" button → calls new admin-only server fn `setPlatformSetting({ key: "news_api_key", value })` (verifies `is_admin` then upserts into `platform_settings`).
  - "Test" button → pings the news API with the saved key and shows OK / error inline.

## Technical details

- `library_books.price_credits` is already `numeric`, so storing `4.0` works with no schema change.
- Obooko has no public API — we parse HTML. If they add rate limiting or Cloudflare, the scraper degrades gracefully (logs errors, keeps prior rows). Cover images are hotlinked initially, then the existing `generate-book-covers` job caches them into the `book-covers` bucket like other sources.
- JAMB uniqueness uses `upper(jamb_number)` so case doesn't create duplicates. The trigger blocks even admins from silently changing a number; admins use `admin_reset_jamb` which nulls it (auditable via `credit_transactions`-style log entry if desired later).
- Public-anon SELECT on `profiles.jamb_number` is scoped by a view: `create view public.jamb_availability as select upper(jamb_number) as jamb from public.profiles where jamb_number is not null` with `grant select ... to anon` — avoids exposing the full profile row.
- News key stays server-side; the admin form never renders the raw value in the DOM after load — only masked.

## Files to add / change

- add: `src/lib/obooko-sync.server.ts`, `src/routes/api/public/hooks/sync-obooko.ts`
- add: `src/lib/jamb.functions.ts` (checkJambAvailable, claimJambNumber, adminResetJamb)
- add: `src/lib/platform-settings-admin.functions.ts` (getPlatformSetting, setPlatformSetting — admin only)
- edit: `src/lib/library-multi-sync.server.ts` + `src/routes/api/public/hooks/sync-library-sources.ts` (include obooko)
- edit: `src/routes/login.tsx` (JAMB field + availability check)
- edit: `src/routes/me.tsx` (one-time JAMB claim modal for legacy users)
- edit: `src/routes/api/news.ts`, `src/routes/api/public/hooks/auto-ebsu-news.ts` (read from platform_settings)
- edit: `src/components/admin/AdminIntegrations.tsx` (News API card)
- migration: profiles.jamb_number + unique index + lock trigger + jamb_availability view + admin_reset_jamb function
