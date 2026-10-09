# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Live results dashboard for กีฬาสาธิตสามัคคี ครั้งที่ 49 “คำมอกหลวงเกมส์”, seen from the point of view of one school ("โรงเรียนเรา" = `SELF_SCHOOL_NAME` in `public/js/format.js`). Code comments, commit messages and docs are written in Thai — keep that convention. `README.md` is the detailed operator manual; `DESIGN.md` / `PRODUCT.md` hold design and audience rules.

## Commands

```bash
npm install
npm start              # builds CSS, serves public/ + /api/gviz at http://localhost:3000 (server.js)
npm run dev:css        # Tailwind watch while editing
npm run build          # Tailwind → public/css/app.css, copy fonts/ + data/mock.json into public/, then stamp
npm run stamp          # re-stamp ?v=<hash> importmaps in every public/*.html (run after any JS/CSS change)
npm run import:sheets -- --dry-run   # Sheets → Supabase import (needs SUPABASE_URL + SUPABASE_SERVICE_KEY to write)
npm run db:push        # apply supabase/migrations/ to the linked project
vercel --prod          # deploy Vercel (NOT triggered by git push)
```

There is no test suite or linter. Verify changes by loading pages (headless Chrome `--dump-dom` against `npm start` works well) and checking the `#main` content. Pages must be opened over http, never `file://`.

## Deployment (two hosts)

- **GitHub Pages** (primary, `https://patumwansport.github.io/satit-sports-dashboard/`): push to `main` → `.github/workflows/pages.yml` builds and publishes `public/`. Site lives under a sub-path, so every link/fetch in the code must be relative (no leading `/`). Push needs the `patumwansport` GitHub account (`gh auth switch -u patumwansport`).
- **Vercel** (`https://satit-sports-dashboard-one.vercel.app`): static mirror of `public/` plus the one serverless function `api/gviz.js`. Not git-linked — redeploy manually with `vercel --prod` whenever `api/` or `public/` changes. `.vercelignore` must keep excluding `server.js` (otherwise Vercel treats the project as an Express app).
- `.github/workflows/sync-sheets.yml` runs `scripts/import-sheets.mjs` every 15 min to mirror the sheet into Supabase for the backup CMS.

## Architecture

**No app server.** All data assembly runs in the browser; Google Sheets is the source of truth.

Data flow: page script (`home.js`, `medals.js`, …) → `loadData()` / `onFreshData()` in `public/js/common.js` → `loadFromSheets()` in `public/js/sheets.js` → gviz JSON per sheet tab → one object with the same schema as `data/mock.json`. Every page renders from that single object.

- **`api/gviz.js` caching proxy**: browsers fetch `GVIZ_PROXY` (see `sheets.js`) and Vercel's CDN caches each tab for 30 s, so heavy traffic never reaches Google. If the proxy fails *or returns something that isn't gviz* (an undeployed Vercel route returns `index.html` with 200), `sheets.js` falls back to calling Google directly. Keep both paths working. The proxy is locked to our `SHEET_ID`. `server.js` mounts the same handler for local dev.
- **Fallback order in `common.js`**: Supabase (only if `public/js/config.js` is filled; currently empty) → Sheets → last good data in localStorage (`dash-data-v1`) → error box with retry. `data/mock.json` is used **only on localhost**; on the live site, sample data must never stand in for real results.
- Pages fetch once on open and never poll. Data that arrives late shows an "อัปเดต" button instead of re-rendering under the reader (see the `onFreshData` comment block).
- `sheets.js` is also imported by Node (`scripts/import-sheets.mjs`), so guard browser globals (`typeof location`).
- gviz pitfalls documented in `sheets.js`: an unknown tab name silently returns the first tab, header rows must be passed explicitly (`headers=`), numeric columns drop text cells, and merged header cells shift columns. Tab ids/names live at the top of `sheets.js`.
- **Two Supabase configs, deliberately separate**: `public/js/config.js` decides where the public site reads match data (empty = Sheets). `public/admin/config.js` enables only the backup CMS (`public/admin/`), visit counting and announcement banners (`public/admin/site.js`, isolated so a Supabase outage never breaks the dashboard). `public/admin.html` is an older CMS, currently disabled. Security relies only on RLS in `supabase/migrations/`; change the schema via migrations + `db:push`, never in the dashboard.
- **Gallery** (`gallery.html`, `drive-photos.js`, `gallery-config.js`): lists a public Google Drive folder tree through the second proxy, `api/drive.js`. It caches each folder listing for 60 s and sends our Vercel domain as `Referer`, because the API key (duplicated from `gallery-config.js`) is referrer-restricted. Fallback: Drive directly, then the sheet's `img` tab.
- Both proxies resolve their origin through `public/js/proxy.js`. `api/gviz.js` only serves the tabs in its `ALLOWED` list, which must mirror the tab constants at the top of `sheets.js`; an unlisted tab silently bypasses the cache.

## Conventions

- **Cache-busting**: each HTML page has a generated `<script type="importmap">` between `<!-- stamp:importmap -->` markers. Never hand-edit it; run `npm run stamp` (included in `build`) after changing any file in `public/js/` or `public/admin/`, or browsers mix old and new modules.
- Styling is Tailwind v4 (`src/input.css`, theme tokens like `text-fg`, `border-line`, `bg-surface`, light/dark) compiled into the committed `public/css/app.css`. New utility classes used in JS need a rebuild to exist.
- Asset lookups map Thai names to files: school crests `assets/school/<abbr without trailing dot>.webp` (falls back to `.png`; convert new ones with `cwebp -q 88 -alpha_q 100`) and mascots `assets/sport_mascot/web/*.webp` (helpers in `common.js`). Sport ids/icons are in `public/assets/icons/<id>.svg`; sports not entered are filtered with `SPORTS_NOT_ENTERED` in `sheets.js`.
- The event title shown on pages comes from `meta.title` in `sheets.js` / `supabase-data.js` (it overwrites the static `<h1>` in `index.html`). Change both together.
- `web/` is an unrelated, unused Vite/React template; ignore it.
