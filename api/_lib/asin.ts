const ASIN_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/product-reviews\/([A-Z0-9]{10})/i,
  /[?&]asin=([A-Z0-9]{10})/i,
];

export function extractAsin(url: string): string | null {
  for (const pattern of ASIN_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

export function reviewsUrlForAsin(asin: string, domain = "amazon.com"): string {
  return `https://www.${domain}/product-reviews/${asin}`;
}
