# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Live results dashboard for กีฬาสาธิตสามัคคี ครั้งที่ 49 “คำมอกหลวงเกมส์”, seen from the point of view of one school ("โรงเรียนเรา" = `SELF_SCHOOL_NAME` in `public/js/format.js`). Code comments, commit messages and docs are written in Thai — keep that convention. `README.md` is the detailed operator manual; `DESIGN.md` / `PRODUCT.md` hold design and audience rules.

## Commands

```bash
npm install
npm start              # builds CSS, serves public/ + /api/gviz at http://localhost:3000 (server.js)
npm run dev:css        # Tailwind watch while editing
npm run check          # scripts/check-consistency.mjs: values duplicated across files must match (run first by build)
npm run build          # check, Tailwind → public/css/app.css, copy fonts/ + data/mock.json into public/, then stamp
npm run stamp          # re-stamp ?v=<hash> importmaps in every public/*.html (run after any JS/CSS change)
npm run import:sheets -- --dry-run   # Sheets → Supabase import (needs SUPABASE_URL + SUPABASE_SERVICE_KEY to write)
npm run db:push        # apply supabase/migrations/ to the linked project
vercel --prod          # manual Vercel deploy (only needed if the VERCEL_TOKEN secret isn't set — see below)
```

There is no test suite or linter. Verify changes by loading pages (headless Chrome `--dump-dom` against `npm start` works well) and checking the `#main` content. Pages must be opened over http, never `file://`.

## Deployment (two hosts)

- **GitHub Pages** (primary, `https://patumwansport.github.io/satit-sports-dashboard/`): push to `main` → `.github/workflows/pages.yml` builds and publishes `public/`. Site lives under a sub-path, so every link/fetch in the code must be relative (no leading `/`). Push needs the `patumwansport` GitHub account (`gh auth switch -u patumwansport`).
- **Vercel** (`https://satit-sports-dashboard-one.vercel.app`): static mirror of `public/` plus the serverless functions `api/gviz.js` and `api/drive.js` (`api/_settings.js` is a shared helper, not an endpoint). Not git-linked; the `vercel` job in `pages.yml` deploys it on every push when the `VERCEL_TOKEN` repo secret exists (otherwise it is skipped and you must run `vercel --prod`). `.vercelignore` must keep excluding `server.js` (otherwise Vercel treats the project as an Express app) and excludes `supabase/`, so `check-consistency.mjs` skips the Edge Function checks there.
- `.github/workflows/sync-sheets.yml` runs `scripts/import-sheets.mjs` roughly every 5 min (each scheduled run loops for 5.5 h because GitHub fires the cron late and sometimes skips 2–4 h; the next run queues behind it via `concurrency`) to mirror the sheet into Supabase for the backup CMS. Each run re-enables the workflow via the API so GitHub's 60-day inactivity rule doesn't silently stop it (which would then let free-tier Supabase pause). Its `default-sheet` job (`import-sheets.mjs --check-default`) fails while `site_settings.sheet_url` ≠ `DEFAULT_SHEET_ID`. The sync refuses to replace `matches` if it would shrink by more than half (`ALLOW_SHRINK=1` / the `allow_shrink` dispatch input overrides).
- Edge Functions and migrations are not deployed by CI: `supabase functions deploy admin-users`, `npm run db:push`.

## Architecture

**No app server.** All data assembly runs in the browser; Google Sheets is the source of truth.

Data flow: page script (`home.js`, `medals.js`, …) → `loadData()` / `onFreshData()` in `public/js/common.js` → `loadFromSheets()` in `public/js/sheets.js` → gviz JSON per sheet tab → one object with the same schema as `data/mock.json`. Every page renders from that single object.

- **`api/gviz.js` caching proxy**: browsers fetch `GVIZ_PROXY` (see `sheets.js`) and Vercel's CDN caches each tab for 30 s (browser 15 s), so heavy traffic never reaches Google. When Google fails it serves the last good copy from function memory (≤30 min, short CDN cache). Responses carry an ETag (304 on match). The tabs every page needs come in one request (`?bundle=main`; `BUNDLE` in `api/gviz.js` must match `BUNDLE_QUERIES` in `sheets.js`) to save Vercel Hobby request quota. If the proxy fails *or returns something that isn't gviz* (an undeployed Vercel route returns `index.html` with 200), `sheets.js` falls back to calling Google directly. Keep both paths working. The proxy is locked to our `SHEET_ID`. `server.js` mounts the same handler for local dev.
- **Fallback order in `common.js`**: Supabase (only if `public/js/config.js` is filled; currently empty) → Sheets → last good data in localStorage (`dash-data-v1`) → error box with retry. `data/mock.json` is used **only on localhost**; on the live site, sample data must never stand in for real results.
- Pages fetch once on open and never poll. Data that arrives late shows an "อัปเดต" button instead of re-rendering under the reader (see the `onFreshData` comment block).
- `sheets.js` is also imported by Node (`scripts/import-sheets.mjs`), so guard browser globals (`typeof location`).
- **Sheet link is configurable from the CMS** (`site_settings.sheet_url`): `api/gviz.js` reads it (memoised 1 min, returns `X-Sheet-Id`; `X-Sheet-Id-Source: default` when Supabase was unreachable since the instance started, which the browser must not remember), the browser remembers that id for the direct-to-Google fallback, and the sync script/CMS call `useSheet()`. Unset/unreadable → `DEFAULT_SHEET_ID` (keep it identical in `sheets.js` and `api/gviz.js`). Tab gids stay hard-coded, so a new sheet must be a copy of the old one.
- **CMS admins** log in with a username or full email. Username login and "forgot password" go through the `login` / `forgot` actions of the `admin-users` Edge Function (no auth required) so the account email never reaches the browser; the old `login_email()` RPC is dropped in migration `20261023000002` (push it only after the new `admin.js` is live on both hosts). Admins have a `role`: `owner` (can manage admin accounts in the CMS "ผู้ดูแลระบบ" view) or `admin` (content only; `is_admin()` covers both). Account create/update/delete goes through the Edge Function `supabase/functions/admin-users` (service role, checks caller is owner); redeploy with `supabase functions deploy admin-users`. Adding a role = migration check + `ROLE_OPTIONS` in `admin.js` + `ROLES` in the function.
- **CMS writes to the sheet through an Apps Script bridge** (`public/admin/apps-script.gs`, URL in `site_settings.sheet_script_url`). It verifies the caller's Supabase access token against `app_admins`, skips formula cells, refuses protected tabs/ranges, and checks the row's previous values before updating/deleting.
- gviz pitfalls documented in `sheets.js`: an unknown tab name/gid silently returns the first tab (`assertScheduleTab` throws if the schedule/results tab has no "วันที่" header), header rows must be passed explicitly (`headers=`) or come back as the first data row (`tableLabels` handles that), numeric columns drop text cells (for the schedule/results tabs `api/gviz.js` refills those nulls from the tab's CSV export, matching rows in order — CSV also contains rows hidden/filtered in the sheet, which admins hide on purpose, so gviz rows stay authoritative; the direct-to-Google fallback has no refill), and merged header cells shift columns. Columns of the results and schedule tabs are found by header text (`resultColumns` / `planColumns`), not fixed positions — the results tab layout already changed once. Tab ids/names live at the top of `sheets.js`.
- **Two Supabase configs, deliberately separate**: `public/js/config.js` decides where the public site reads match data (empty = Sheets). `public/admin/config.js` enables only the backup CMS (`public/admin/`), visit counting and announcement banners (`public/admin/site.js`, isolated so a Supabase outage never breaks the dashboard). `public/admin.html` is an older CMS, currently disabled. Security relies only on RLS in `supabase/migrations/`; change the schema via migrations + `db:push`, never in the dashboard.
- **Gallery** (`gallery.html`, `drive-photos.js`, `gallery-config.js`): lists a public Google Drive folder tree through the second proxy, `api/drive.js`, which only serves `ALLOWED_ROOTS` (mirrors `gallery-config.js`), the CMS `gallery_drive_folder`, and their subfolders (403 otherwise; the browser then asks Drive directly). It prefers a server-only key in the Vercel env `GOOGLE_API_KEY`, falling back to `BROWSER_KEY`. Its `?tree=<root>` mode returns the whole photo library (folder tree + image ids, ~200 KB gzipped) in one response, memoised in the function and CDN-cached so pages need a single request; per-folder `?parent=` listings remain the fallback. It sends our Vercel domain as `Referer`, because the API key (duplicated from `gallery-config.js`) is referrer-restricted. Fallback: Drive directly, then the sheet's `img` tab.
- Both proxies resolve their origin through `public/js/proxy.js`. `api/gviz.js` only serves the tabs in its `ALLOWED` list, which must mirror the tab constants at the top of `sheets.js`; an unlisted tab silently bypasses the cache.
- Drive `<img>`s carry `data-fb` (fallback URL); `public/js/img-retry.js` (imported by `common.js`) handles their errors in one capture listener — fallback, then 3 spaced retries — and only lets the error reach page-level handlers once it gives up. Don't add per-image fallback swaps.

## Conventions

- **Cache-busting**: each HTML page has a generated `<script type="importmap">` between `<!-- stamp:importmap -->` markers. Never hand-edit it; run `npm run stamp` (included in `build`) after changing any file in `public/js/` or `public/admin/`, or browsers mix old and new modules.
- Styling is Tailwind v4 (`src/input.css`, theme tokens like `text-fg`, `border-line`, `bg-surface`, light/dark) compiled into the committed `public/css/app.css`. New utility classes used in JS need a rebuild to exist.
- Asset lookups map Thai names to files: school crests `assets/school/<abbr without trailing dot>.webp` (falls back to `.png`; convert new ones with `cwebp -q 88 -alpha_q 100`) and mascots `assets/sport_mascot/web/*.webp` (helpers in `common.js`). Sport ids/icons are in `public/assets/icons/<id>.svg`; sports not entered are filtered with `SPORTS_NOT_ENTERED` in `sheets.js`.
- The event title shown on pages comes from `meta.title` in `sheets.js` / `supabase-data.js` (it overwrites the static `<h1>` in `index.html`). Change both together.
- `web/` is an unrelated, unused Vite/React template; ignore it.
