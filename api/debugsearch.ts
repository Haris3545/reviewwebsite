import type { VercelRequest, VercelResponse } from "@vercel/node";

const ACTOR_SLUG = "junglee~amazon-crawler";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      res.status(400).json({ error: "APIFY_TOKEN not set" });
      return;
    }
    const query = (req.query.q as string) || "delonghi heaters";
    const domain = (req.query.domain as string) || "amazon.co.uk";
    const searchUrl = `https://www.${domain}/s?k=${encodeURIComponent(query)}`;
    const endpoint = `https://api.apify.com/v2/acts/${ACTOR_SLUG}/run-sync-get-dataset-items?token=${encodeURIComponent(
      token,
    )}`;
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryOrProductUrls: [{ url: searchUrl }],
        maxItemsPerStartUrl: 5,
        maxSearchPagesPerStartUrl: 1,
        scrapeProductDetails: false,
      }),
    });
    const status = r.status;
    const items = await r.json();
    res.status(200).json({ status, sample: items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "unknown" });
  }
}
