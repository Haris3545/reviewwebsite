export interface ReviewRecord {
  productUrl: string;
  productTitle: string;
  asin: string;
  reviewer: string;
  rating: number | null;
  title: string;
  body: string;
  date: string;
  verifiedPurchase: boolean;
  helpfulVotes: number | null;
}

export interface ProductResult {
  url: string;
  asin: string | null;
  productTitle: string;
  source: "apify" | "scraper" | "error";
  reviews: ReviewRecord[];
  error?: string;
}

export interface ReviewsResponse {
  results: ProductResult[];
}
