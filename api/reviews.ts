import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ProductResult, ReviewRecord } from "../src/lib/types";
import { extractAsin } from "./_lib/asin.js";
import { fetchReviewsViaApify } from "./_lib/apify.js";
import { mapWithConcurrency } from "./_lib/concurrency.js";

const MAX_URLS_PER_REQUEST = 25;
// How many Apify Actor runs we allow in flight at once. Each run reserves
// its own memory against the account's concurrent-memory limit, so this
// stays conservative rather than firing the whole batch simultaneously.
const CONCURRENT_APIFY_RUNS = 3;
// Apify fallback calls are staggered across this window rather than fired
// all at once, both to smooth out account memory usage and to give the
// frontend's staged loading UI something real to pace against.
const APIFY_STAGGER_WINDOW_MS = 7000;
const APIFY_STAGGER_STEP_MS = 900;
const SCRAPER_CONCURRENCY = 5;

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

    // Stage 1: try the direct fetch for every URL first — it's free and
    // fast. Only the URLs that fail or come back empty move on to stage 2.
    const stage1 = await mapWithConcurrency(
      urls as string[],
      SCRAPER_CONCURRENCY,
      async (url: string) => ({ url, reviews: await attemptScraper(url) }),
    );

    const resultByUrl = new Map<string, ProductResult>();
    const needsApify: string[] = [];

    for (const { url, reviews } of stage1) {
      const asin = extractAsin(url);
      if (reviews) {
        resultByUrl.set(url, {
          url,
          asin,
          productTitle: reviews[0]?.productTitle ?? "",
          source: "scraper",
          reviews,
        });
      } else {
        needsApify.push(url);
      }
    }

    // Stage 2: whatever stage 1 couldn't get, fall back to Apify — staggered
    // rather than fired all at once.
    if (needsApify.length > 0) {
      const stage2 = await mapWithConcurrency(
        needsApify,
        CONCURRENT_APIFY_RUNS,
        async (url: string, index: number): Promise<ProductResult> => {
          const asin = extractAsin(url);
          const delay = Math.min(index * APIFY_STAGGER_STEP_MS, APIFY_STAGGER_WINDOW_MS);
          if (delay > 0) await sleep(delay);

          if (!apifyToken) {
            return {
              url,
              asin,
              productTitle: "",
              source: "error",
              reviews: [],
              error: "Direct fetch failed and no APIFY_TOKEN is configured as a fallback.",
            };
          }

          try {
            const reviews = await fetchReviewsViaApify(url, apifyToken);
            return {
              url,
              asin,
              productTitle: reviews[0]?.productTitle ?? "",
              source: "apify",
              reviews,
            };
          } catch (err) {
            return {
              url,
              asin,
              productTitle: "",
              source: "error",
              reviews: [],
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      );

      for (const result of stage2) {
        resultByUrl.set(result.url, result);
      }
    }

    const results: ProductResult[] = (urls as string[]).map(
      (url) => resultByUrl.get(url) as ProductResult,
    );

    res.status(200).json({ results });
  } catch (err) {
    console.error("Unhandled error in /api/reviews:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
