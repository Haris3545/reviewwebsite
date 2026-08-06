# Amazon Review Extractor

Paste one or more Amazon product links and pull their reviews into a table you can export as CSV or PDF.

- Frontend: React + Vite (static)
- Backend: Vercel serverless function at `api/reviews.ts`
- Data source: [Apify's Amazon Reviews Scraper](https://apify.com/junglee/amazon-reviews-scraper) actor (has a free usage tier), with an optional direct-scraper fallback

## Important: Amazon's Terms of Service

Amazon's ToS prohibit automated scraping of their site. This project defaults to using
[Apify](https://apify.com)'s hosted Amazon Reviews Scraper actor, which is a third-party service —
using it doesn't eliminate the ToS question, but it keeps the actual scraping off your own
infrastructure and behind a service built for this. A raw fallback scraper (`api/_lib/scraper.ts`)
is included for cases with no Apify token, but it is **off by default** and must be explicitly
enabled (`ALLOW_SCRAPER_FALLBACK=true`). It fetches Amazon pages directly, is fragile since Amazon
frequently changes its markup, and Amazon actively blocks bot traffic. Use it, if at all, only for
personal/non-commercial experimentation and expect it to break.

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

Set `APIFY_TOKEN` (and optionally `ALLOW_SCRAPER_FALLBACK`) as environment variables in the Vercel
project dashboard.

## How it works

1. Paste one or more Amazon product URLs (one per line) into the textarea.
2. The frontend POSTs the list to `/api/reviews`.
3. For each URL, the backend extracts the ASIN and fetches reviews via Apify (or the scraper
   fallback if enabled).
4. Results are normalized into a common `ReviewRecord` shape and returned to the frontend.
5. The table can be filtered by product and exported as CSV (`src/lib/csv.ts`) or PDF
   (`src/lib/pdf.ts`), both generated client-side.

## Notes on the Apify integration

The exact input/output schema for third-party Apify actors can change over time. If review
fetching starts failing, check the actor's page (linked above) for the current schema and update
`api/_lib/apify.ts` accordingly — the actor slug, request/response field names are isolated to
that one file.
