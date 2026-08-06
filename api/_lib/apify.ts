import type { ReviewRecord } from "../../src/lib/types";

// Apify "Amazon Reviews Scraper" actor by junglee.
// Store page: https://apify.com/junglee/amazon-reviews-scraper
// Verify the input/output schema there before relying on this in production —
// third-party actor schemas can change without notice.
const ACTOR_SLUG = "junglee~amazon-reviews-scraper";
const MAX_REVIEWS_PER_PRODUCT = 100;

interface ApifyRawItem {
  productAsin?: string;
  productTitle?: string;
  title?: string;
  ratingScore?: number;
  rating?: number;
  reviewTitle?: string;
  reviewDescription?: string;
  reviewText?: string;
  reviewedIn?: string;
  date?: string;
  isVerified?: boolean;
  verified?: boolean;
  reviewReaction?: string;
  userName?: string;
  profileName?: string;
  reviewer?: string;
  name?: string;
}

function pick<T>(...values: (T | undefined | null)[]): T | undefined {
  return values.find((v) => v !== undefined && v !== null);
}

function parseHelpfulVotes(reaction: string | undefined): number | null {
  if (!reaction) return null;
  const match = reaction.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeItem(item: ApifyRawItem, productUrl: string): ReviewRecord {
  return {
    productUrl,
    productTitle: pick(item.productTitle, item.title) ?? "",
    asin: item.productAsin ?? "",
    reviewer: pick(item.userName, item.profileName, item.reviewer, item.name) ?? "Anonymous",
    rating: pick(item.ratingScore, item.rating) ?? null,
    title: item.reviewTitle ?? "",
    body: pick(item.reviewDescription, item.reviewText) ?? "",
    date: pick(item.date, item.reviewedIn) ?? "",
    verifiedPurchase: Boolean(pick(item.isVerified, item.verified)),
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

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productUrls: [{ url: productUrl }],
      maxReviews: MAX_REVIEWS_PER_PRODUCT,
      includeGdprSensitive: true,
    }),
  });

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
