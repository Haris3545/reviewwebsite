import type { VercelRequest, VercelResponse } from "@vercel/node";

const ACTOR_SLUG = "junglee~amazon-reviews-scraper";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      res.status(400).json({ error: "APIFY_TOKEN not set" });
      return;
    }
    const url = (req.query.url as string) || "https://www.amazon.co.uk/dp/B00CA1T07G";
    const endpoint = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(
      token,
    )}`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productUrls: [{ url }],
        maxReviews: 2,
        includeGdprSensitive: true,
      }),
    });
    const items = await r.json();
    res.status(200).json({ sample: items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
}
