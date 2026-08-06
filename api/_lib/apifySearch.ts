// Apify "Amazon Product Scraper" actor by junglee, used here for keyword search.
// Store page: https://apify.com/junglee/amazon-crawler
// Verify the input/output schema there before relying on this in production —
// third-party actor schemas can change without notice.
const ACTOR_SLUG = "junglee~amazon-crawler";

export interface SearchResultItem {
  asin: string;
  title: string;
  url: string;
  stars: number | null;
  reviewsCount: number | null;
}

interface ApifySearchRawItem {
  asin?: string;
  title?: string;
  stars?: number;
  reviewsCount?: number;
}

export async function searchAmazonProducts(
  query: string,
  domain: string,
  token: string,
  maxItems = 20,
): Promise<SearchResultItem[]> {
  const searchUrl = `https://www.${domain}/s?k=${encodeURIComponent(query)}`;
  const endpoint = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(
    token,
  )}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      categoryOrProductUrls: [{ url: searchUrl }],
      maxItemsPerStartUrl: maxItems,
      maxSearchPagesPerStartUrl: 1,
      scrapeProductDetails: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Apify search request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const items = (await res.json()) as ApifySearchRawItem[];
  if (!Array.isArray(items)) {
    throw new Error("Unexpected response shape from Apify search actor.");
  }

  return items
    .filter((item) => item.asin)
    .map((item) => ({
      asin: item.asin!,
      title: item.title ?? "",
      // The actor doesn't return a direct product URL, only the ASIN — build
      // the canonical /dp/ link ourselves from the search domain.
      url: `https://www.${domain}/dp/${item.asin}`,
      stars: item.stars ?? null,
      reviewsCount: item.reviewsCount ?? null,
    }));
}
