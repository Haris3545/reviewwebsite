import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { ProductResult } from "../src/lib/types";
import { extractAsin } from "./_lib/asin";
import { fetchReviewsViaApify } from "./_lib/apify";
import { fetchReviewsViaScraper } from "./_lib/scraper";

const MAX_URLS_PER_REQUEST = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const results: ProductResult[] = await Promise.all(
    urls.map(async (url: string): Promise<ProductResult> => {
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
    }),
  );

  res.status(200).json({ results });
}
