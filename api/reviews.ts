import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ProductResult, ReviewRecord } from "../src/lib/types";
import { extractAsin } from "./_lib/asin.js";
import { fetchReviewsViaApify } from "./_lib/apify.js";
import { mapWithConcurrency, Semaphore, withTimeout } from "./_lib/concurrency.js";

const MAX_URLS_PER_REQUEST = 25;
// How many URLs are actively moving through the stage-1/stage-2 pipeline at
// once. Apify concurrency is capped separately (below) — this just bounds
// how many outbound requests to Amazon happen at once.
const PIPELINE_CONCURRENCY = 6;
// How many Apify Actor runs we allow in flight at once, shared across the
// whole batch regardless of when each URL becomes ready for it. Each run
// reserves its own memory against the account's concurrent-memory limit.
const CONCURRENT_APIFY_RUNS = 3;
// Apify fallback calls are staggered across this window rather than fired
// all at once, both to smooth out account memory usage and to give the
// frontend's staged loading UI something real to pace against.
const APIFY_STAGGER_WINDOW_MS = 7000;
const APIFY_STAGGER_STEP_MS = 900;
const STAGE1_TIMEOUT_MS = 10000;
// Vercel's function timeout is 60s (see vercel.json); this leaves headroom
// for the response to actually get written instead of Vercel killing the
// invocation mid-flight and returning a bare 504 with no data at all. Once
// the deadline passes, remaining URLs are reported as timed-out rather than
// attempted.
const REQUEST_DEADLINE_MS = 50000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptScraper(url: string): Promise<ReviewRecord[] | null> {
  try {
    // Dynamically imported so a load-time failure in this module (e.g. the
    // cheerio dependency) can't crash the whole function.
    const { fetchReviewsViaScraper } = await import("./_lib/scraper.js");
    const reviews = await fetchReviewsViaScraper(url);
    return reviews.length > 0 ? reviews : null;
  } catch {
    return null;
  }
}

function errorResult(url: string, asin: string | null, error: string): ProductResult {
  return { url, asin, productTitle: "", source: "error", reviews: [], error };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { urls } = req.body ?? {};
    if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === "string")) {
      res.status(400).json({ error: "Body must include a non-empty array of URL strings." });
      return;
    }
    if (urls.length > MAX_URLS_PER_REQUEST) {
      res.status(400).json({ error: `Max ${MAX_URLS_PER_REQUEST} URLs per request.` });
      return;
    }

    const apifyToken = process.env.APIFY_TOKEN;
    const requestStart = Date.now();
    const remainingBudget = () => REQUEST_DEADLINE_MS - (Date.now() - requestStart);

    const apifySemaphore = new Semaphore(CONCURRENT_APIFY_RUNS);
    let apifyStarts = 0;

    async function processUrl(url: string): Promise<ProductResult> {
      const asin = extractAsin(url);

      if (remainingBudget() <= 0) {
        return errorResult(url, asin, "Ran out of time before this listing could be processed.");
      }

      // Stage 1: direct fetch, always tried first.
      let reviews: ReviewRecord[] | null;
      try {
        reviews = await withTimeout(
          attemptScraper(url),
          Math.min(STAGE1_TIMEOUT_MS, Math.max(1000, remainingBudget())),
          "Direct fetch timed out.",
        );
      } catch {
        reviews = null;
      }

      if (reviews) {
        return {
          url,
          asin,
          productTitle: reviews[0]?.productTitle ?? "",
          source: "scraper",
          reviews,
        };
      }

      // Stage 2: Apify fallback.
      if (!apifyToken) {
        return errorResult(
          url,
          asin,
          "Direct fetch failed and no APIFY_TOKEN is configured as a fallback.",
        );
      }
      if (remainingBudget() <= 3000) {
        return errorResult(
          url,
          asin,
          "Ran out of time before falling back to Apify for this listing.",
        );
      }

      const staggerIndex = apifyStarts++;
      const stagger = Math.min(staggerIndex * APIFY_STAGGER_STEP_MS, APIFY_STAGGER_WINDOW_MS);
      const cappedStagger = Math.min(stagger, Math.max(0, remainingBudget() - 5000));
      if (cappedStagger > 0) await sleep(cappedStagger);

      return apifySemaphore.run(async () => {
        if (remainingBudget() <= 0) {
          return errorResult(url, asin, "Ran out of time waiting for an Apify run to start.");
        }
        try {
          const apifyReviews = await withTimeout(
            fetchReviewsViaApify(url, apifyToken),
            Math.max(1000, remainingBudget()),
            "Apify call timed out for this listing.",
          );
          return {
            url,
            asin,
            productTitle: apifyReviews[0]?.productTitle ?? "",
            source: "apify",
            reviews: apifyReviews,
          };
        } catch (err) {
          return errorResult(url, asin, err instanceof Error ? err.message : "Unknown error");
        }
      });
    }

    const results = await mapWithConcurrency(urls as string[], PIPELINE_CONCURRENCY, processUrl);

    res.status(200).json({ results });
  } catch (err) {
    console.error("Unhandled error in /api/reviews:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
