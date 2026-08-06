import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { ensureSchema, rowToProject } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureSchema();

    const id = req.query.id;
    if (typeof id !== "string") {
      res.status(400).json({ error: "Invalid project id." });
      return;
    }

    if (req.method === "GET") {
      const { rows } = await sql`SELECT * FROM projects WHERE id = ${id}`;
      if (rows.length === 0) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      res.status(200).json({ project: rowToProject(rows[0] as never) });
      return;
    }

    if (req.method === "PATCH") {
      const body = req.body ?? {};
      const { name, urls, searchQuery, searchDomain, results } = body;

      const { rows: existingRows } = await sql`SELECT * FROM projects WHERE id = ${id}`;
      if (existingRows.length === 0) {
        res.status(404).json({ error: "Project not found." });
        return;
      }
      const existing = existingRows[0];

      const { rows } = await sql`
        UPDATE projects
        SET
          name = ${typeof name === "string" && name.trim() ? name.trim() : existing.name},
          urls = ${Array.isArray(urls) ? urls : existing.urls},
          search_query = ${searchQuery !== undefined ? searchQuery : existing.search_query},
          search_domain = ${searchDomain !== undefined ? searchDomain : existing.search_domain},
          results = ${results !== undefined ? JSON.stringify(results) : existing.results},
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;
      res.status(200).json({ project: rowToProject(rows[0] as never) });
      return;
    }

    if (req.method === "DELETE") {
      await sql`DELETE FROM projects WHERE id = ${id}`;
      res.status(204).end();
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("Unhandled error in /api/projects/[id]:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Unexpected server error.",
    });
  }
}
