import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchAmazonProducts } from "./_lib/apifySearch.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { query, domain } = req.body ?? {};
    if (typeof query !== "string" || query.trim().length === 0) {
      res.status(400).json({ error: "Body must include a non-empty 'query' string." });
      return;
    }

    const apifyToken = process.env.APIFY_TOKEN;
    if (!apifyToken) {
      res.status(400).json({
        error: "Keyword search requires APIFY_TOKEN to be set (the direct scraper fallback doesn't support search).",
      });
      return;
    }

    const items = await searchAmazonProducts(
      query.trim(),
      typeof domain === "string" && domain ? domain : "amazon.com",
      apifyToken,
    );

    res.status(200).json({ items });
  } catch (err) {
    console.error("Unhandled error in /api/search:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
