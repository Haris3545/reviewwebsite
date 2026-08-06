# Amazon Review Extractor

Paste one or more Amazon product links — or search by keyword/brand — and pull matching reviews into a table you can export as CSV or PDF.

- Frontend: React + Vite (static), with a Projects page for saving and revisiting past pulls
- Backend: Vercel serverless functions at `api/reviews.ts` (fetch reviews for given URLs),
  `api/search.ts` (find products by keyword), and `api/projects/` (save/list/update/delete)
- Storage: Vercel Postgres, for saved projects only
- Data source: a direct fetch of Amazon's review pages is tried first for every URL
  (`api/_lib/scraper.ts`); anything that fails or comes back empty falls back to
  [Apify's Amazon Reviews Scraper](https://apify.com/junglee/amazon-reviews-scraper) actor for
  reviews, or [Amazon Product Scraper](https://apify.com/junglee/amazon-crawler) for keyword
  search (both pay-per-result, no free tier — see the pricing note below)

## Important: Amazon's Terms of Service

Amazon's ToS prohibit automated scraping of their site. **This app's default behavior is to try a
direct fetch of Amazon's review pages first, for every request** (`api/_lib/scraper.ts`) — this is
a deliberate tradeoff to avoid burning Apify usage on every single lookup, made explicitly at the
project owner's request. It's fragile (Amazon changes its markup and blocks bot traffic) and it is
the ToS-risk behavior earlier versions of this README kept opt-in. If you want to remove that risk
entirely and only use Apify's hosted actors, delete the stage-1 attempt in `api/reviews.ts` (the
`attemptScraper` call) so every request goes straight to Apify.

Apify's actors are pay-per-result with no free-tier credit applying — roughly $3 per 1,000 reviews
or search results (see the "Apify usage" section below).

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and fill in your Apify token:

```bash
cp .env.example .env
```

1. Create a free account at [apify.com](https://apify.com).
2. Grab your API token from Settings → Integrations.
3. Set `APIFY_TOKEN` in `.env`.
4. In the Vercel dashboard, open the project's **Storage** tab and provision a Postgres database —
   this wires up `POSTGRES_URL` and friends automatically, which the Projects feature needs. No
   separate migration step: the `projects` table is created on first use.

## Run locally

This project uses Vercel serverless functions for `/api/reviews`, so run it through the Vercel CLI
so both the frontend and API route work together:

```bash
npm install -g vercel   # if you don't have it
vercel dev
```

Alternatively, run just the frontend with `npm run dev` (`vite`), but note the `/api/reviews` calls
will fail until you're running through `vercel dev` or have deployed to Vercel.

## Deploy

```bash
vercel
```

Set `APIFY_TOKEN` as an environment variable in the Vercel project dashboard, and provision a
Postgres database under the project's Storage tab (see Setup above) if you haven't already.

## How it works

**Paste links mode**
1. Paste one or more Amazon product URLs (one per line) into the textarea.
2. The frontend POSTs the list to `/api/reviews`.
3. For each URL, the backend first tries a direct fetch of Amazon's review page. URLs that fail or
   come back empty fall back to Apify, staggered over a few seconds rather than fired all at once
   (see "Apify usage" below).
4. Results are normalized into a common `ReviewRecord` shape and returned to the frontend.
5. Optionally save the results as a named project (Postgres-backed) — reopen, re-fetch, rename, or
   delete it later from the Projects page.

**Search by keyword mode**
1. Enter a term (e.g. "delonghi heaters") and pick a domain (amazon.co.uk / amazon.com).
2. The frontend POSTs to `/api/search`, which runs an Amazon keyword search via Apify's Amazon
   Product Scraper actor — this matches on what a listing actually is, not just words in its
   title, so it picks up products a plain title search would miss. Requires `APIFY_TOKEN` (the
   scraper fallback doesn't support search).
3. Matching products are shown as a checklist; select the ones you want and fetch reviews for all
   of them at once, same as paste-links mode.

Either way, the table can be filtered by product and exported as CSV (`src/lib/csv.ts`) or PDF
(`src/lib/pdf.ts`), both generated client-side.

## Notes on the Apify integration

The exact input/output schema for third-party Apify actors can change over time. If review
fetching or search starts failing, check the actor pages (linked above) for the current schema and
update `api/_lib/apify.ts` / `api/_lib/apifySearch.ts` accordingly — the actor slugs and
request/response field names are isolated to those two files.

## Apify usage

To avoid tripping Apify's account-wide concurrent-memory limit (surfaces as a 402
`actor-memory-limit-exceeded` error, unrelated to needing a paid plan — it just means too many
Actor runs are in flight at once), `api/reviews.ts`:

- Only calls Apify for URLs where the stage-1 direct fetch failed.
- Runs at most 3 Apify Actor runs concurrently (`CONCURRENT_APIFY_RUNS` in `api/reviews.ts`).
- Staggers the start of each fallback call across roughly a 7-second window
  (`APIFY_STAGGER_WINDOW_MS` / `APIFY_STAGGER_STEP_MS`) instead of firing them all immediately.

If you still hit the memory-limit error, check
[console.apify.com/actors/runs](https://console.apify.com/actors/runs) for stuck Running/Queued
runs and abort them.

## Troubleshooting a 500 from `/api/reviews` or `/api/search`

- Most likely cause: `APIFY_TOKEN` isn't set in the Vercel project's environment variables.
- Check the function's logs in the Vercel dashboard (Deployments → your deployment → Functions) —
  both endpoints log the underlying error with `console.error` and also return it in the JSON
  response body, so the error shown in the UI should now say what actually failed.
