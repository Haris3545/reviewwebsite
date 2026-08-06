import type { ReviewRecord } from "../../src/lib/types";

// Apify "Amazon Reviews Scraper" actor by junglee.
// Store page: https://apify.com/junglee/amazon-reviews-scraper
// Verify the input/output schema there before relying on this in production —
// third-party actor schemas can change without notice.
const ACTOR_SLUG = "junglee~amazon-reviews-scraper";
// Kept modest so a single run finishes quickly enough to fit several runs
// inside one request's time budget — raise if you want more reviews per
// product and don't mind slower/more expensive runs.
const MAX_REVIEWS_PER_PRODUCT = 40;
const FETCH_TIMEOUT_MS = 40000;

interface ApifyRawItem {
  productAsin?: string;
  ratingScore?: number;
  reviewTitle?: string;
  reviewDescription?: string;
  reviewedIn?: string;
  date?: string;
  isVerified?: boolean;
  reviewReaction?: string;
  username?: string;
}

function parseHelpfulVotes(reaction: string | undefined): number | null {
  if (!reaction) return null;
  const match = reaction.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeItem(item: ApifyRawItem, productUrl: string): ReviewRecord {
  const asin = item.productAsin ?? "";
  return {
    productUrl,
    // This actor doesn't return a product title field — fall back to the
    // ASIN so the UI/exports always have something to group/label by.
    productTitle: asin,
    asin,
    reviewer: item.username ?? "Anonymous",
    rating: item.ratingScore ?? null,
    title: item.reviewTitle ?? "",
    body: item.reviewDescription ?? "",
    date: item.date ?? item.reviewedIn ?? "",
    verifiedPurchase: Boolean(item.isVerified),
    helpfulVotes: parseHelpfulVotes(item.reviewReaction),
  };
}

export async function fetchReviewsViaApify(
  productUrl: string,
  token: string,
): Promise<ReviewRecord[]> {
  const endpoint = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token,
  )}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productUrls: [{ url: productUrl }],
        maxReviews: MAX_REVIEWS_PER_PRODUCT,
        includeGdprSensitive: true,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const items = (await res.json()) as ApifyRawItem[];
  if (!Array.isArray(items)) {
    throw new Error("Unexpected response shape from Apify actor.");
  }

  return items.map((item) => normalizeItem(item, productUrl));
}
