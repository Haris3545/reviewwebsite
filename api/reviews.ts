import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ProductResult } from "../src/lib/types";
import { extractAsin } from "./_lib/asin.js";
import { fetchReviewsViaApify } from "./_lib/apify.js";
import { mapWithConcurrency } from "./_lib/concurrency.js";

const MAX_URLS_PER_REQUEST = 25;
// How many Apify Actor runs we allow in flight at once. Each run reserves
// its own memory against the account's concurrent-memory limit, so this
// stays conservative rather than firing the whole batch simultaneously.
const CONCURRENT_APIFY_RUNS = 3;

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
    const allowScraperFallback = process.env.ALLOW_SCRAPER_FALLBACK === "true";

    const results: ProductResult[] = await mapWithConcurrency(
      urls,
      CONCURRENT_APIFY_RUNS,
      async (url: string): Promise<ProductResult> => {
        const asin = extractAsin(url);
        try {
          if (apifyToken) {
            const reviews = await fetchReviewsViaApify(url, apifyToken);
            return {
              url,
              asin,
              productTitle: reviews[0]?.productTitle ?? "",
              source: "apify",
              reviews,
            };
          }

          if (allowScraperFallback) {
            // Dynamically imported so a load-time failure in this module
            // (e.g. the cheerio dependency) can't crash the whole function
            // when the fallback isn't even in use.
            const { fetchReviewsViaScraper } = await import("./_lib/scraper.js");
            const reviews = await fetchReviewsViaScraper(url);
            return {
              url,
              asin,
              productTitle: reviews[0]?.productTitle ?? "",
              source: "scraper",
              reviews,
            };
          }

          throw new Error(
            "No review data source configured. Set APIFY_TOKEN, or set ALLOW_SCRAPER_FALLBACK=true to use the direct scraper fallback.",
          );
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

    res.status(200).json({ results });
  } catch (err) {
    console.error("Unhandled error in /api/reviews:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
