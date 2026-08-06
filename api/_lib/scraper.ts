import type { ReviewRecord } from "../../src/lib/types";
import { extractAsin, reviewsUrlForAsin } from "./asin.js";

/**
 * DIRECT FETCH — always tried first (see api/reviews.ts), falls back to
 * Apify on failure. Fetches Amazon's review pages and parses the HTML
 * directly. Amazon's Terms of Service prohibit automated scraping of their
 * site, and they run active bot detection that can rate-limit or block the
 * requesting IP — expect this to break whenever Amazon changes its markup.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

function parseRating(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/([\d.]+)\s+out of/);
  return match ? Number(match[1]) : null;
}

function parseHelpful(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function fetchReviewsViaScraper(productUrl: string): Promise<ReviewRecord[]> {
  const cheerio = await import("cheerio");
  const asin = extractAsin(productUrl);
  if (!asin) {
    throw new Error("Could not determine ASIN from URL.");
  }

  const pageUrl = reviewsUrlForAsin(asin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`Amazon returned ${res.status} — page may be blocked or unavailable.`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const productTitle = $("a[data-hook='product-link']").first().text().trim();
  const reviews: ReviewRecord[] = [];

  $("div[data-hook='review']").each((_, el) => {
    const node = $(el);
    const reviewer = node.find(".a-profile-name").first().text().trim();
    const ratingText = node.find("[data-hook='review-star-rating'] span").first().text().trim();
    const title = node
      .find("[data-hook='review-title'] span:not(:has(span))")
      .last()
      .text()
      .trim();
    const body = node.find("[data-hook='review-body'] span").first().text().trim();
    const date = node.find("[data-hook='review-date']").first().text().trim();
    const verified = node.find("[data-hook='avp-badge']").length > 0;
    const helpfulText = node.find("[data-hook='helpful-vote-statement']").first().text().trim();

    reviews.push({
      productUrl,
      productTitle,
      asin,
      reviewer: reviewer || "Anonymous",
      rating: parseRating(ratingText),
      title,
      body,
      date,
      verifiedPurchase: verified,
      helpfulVotes: parseHelpful(helpfulText),
    });
  });

  return reviews;
}
