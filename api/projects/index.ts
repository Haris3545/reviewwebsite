import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";
import { ensureSchema, rowToProject } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema();

    if (req.method === "GET") {
      const { rows } = await sql`
        SELECT id, name, mode, urls, results, updated_at
        FROM projects
        ORDER BY updated_at DESC
      `;
      const summaries = rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        mode: row.mode === "search" ? "search" : "links",
        productCount: Array.isArray(row.results) ? row.results.length : 0,
        reviewCount: Array.isArray(row.results)
          ? row.results.reduce(
              (sum: number, r: { reviews?: unknown[] }) => sum + (r.reviews?.length ?? 0),
              0,
            )
          : 0,
        updatedAt: row.updated_at as string,
      }));
      res.status(200).json({ projects: summaries });
      return;
    }

    if (req.method === "POST") {
      const body = req.body ?? {};
      const { name, mode, urls, searchQuery, searchDomain, results } = body;

      if (typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Project name is required." });
        return;
      }
      if (mode !== "links" && mode !== "search") {
        res.status(400).json({ error: "mode must be 'links' or 'search'." });
        return;
      }
      if (!Array.isArray(results)) {
        res.status(400).json({ error: "results must be an array." });
        return;
      }

      const id = randomUUID();
      const { rows } = await sql`
        INSERT INTO projects (id, name, mode, urls, search_query, search_domain, results)
        VALUES (
          ${id},
          ${name.trim()},
          ${mode},
          ${Array.isArray(urls) ? urls : []},
          ${searchQuery ?? null},
          ${searchDomain ?? null},
          ${JSON.stringify(results)}
        )
        RETURNING *
      `;
      res.status(201).json({ project: rowToProject(rows[0] as never) });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Unhandled error in /api/projects:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
