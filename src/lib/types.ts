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

export interface SearchResultItem {
  asin: string;
  title: string;
  url: string;
  stars: number | null;
  reviewsCount: number | null;
}

export interface SearchResponse {
  items: SearchResultItem[];
}

export interface Project {
  id: string;
  name: string;
  mode: "links" | "search";
  urls: string[];
  searchQuery: string | null;
  searchDomain: string | null;
  results: ProductResult[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  mode: "links" | "search";
  productCount: number;
  reviewCount: number;
  updatedAt: string;
}
