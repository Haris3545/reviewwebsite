import { sql } from "@vercel/postgres";
import type { Project, ProductResult } from "../../src/lib/types.js";

let schemaReady: Promise<unknown> | null = null;

// Runs once per cold start; CREATE TABLE IF NOT EXISTS is cheap and
// idempotent so there's no separate migration step to run by hand.
export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mode TEXT NOT NULL,
        urls TEXT[] NOT NULL DEFAULT '{}',
        search_query TEXT,
        search_domain TEXT,
        results JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
  }
  return schemaReady;
}

interface ProjectRow {
  id: string;
  name: string;
  mode: string;
  urls: string[];
  search_query: string | null;
  search_domain: string | null;
  results: ProductResult[];
  created_at: string;
  updated_at: string;
}

export function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode === "search" ? "search" : "links",
    urls: row.urls ?? [],
    searchQuery: row.search_query,
    searchDomain: row.search_domain,
    results: row.results,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
