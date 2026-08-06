import { useMemo, useState } from "react";
import type { ProductResult, ReviewsResponse } from "./lib/types";
import { downloadCsv } from "./lib/csv";
import { downloadPdf } from "./lib/pdf";

function parseUrls(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  );
}

export default function App() {
  const [urlsInput, setUrlsInput] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>("all");

  const urls = useMemo(() => parseUrls(urlsInput), [urlsInput]);

  const allReviews = useMemo(() => results.flatMap((r) => r.reviews), [results]);

  const filteredReviews = useMemo(() => {
    if (productFilter === "all") return allReviews;
    return allReviews.filter((r) => r.productUrl === productFilter);
  }, [allReviews, productFilter]);

  async function handleFetch() {
    if (urls.length === 0) {
      setError("Paste at least one Amazon product link.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }
      const data: ReviewsResponse = await res.json();
      setResults(data.results);
      setProductFilter("all");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Amazon Review Extractor</h1>
        <p className="subtitle">
          Paste one or more Amazon product links (one per line) to pull their reviews into a
          spreadsheet you can export as CSV or PDF.
        </p>
      </header>

      <section className="input-section">
        <textarea
          value={urlsInput}
          onChange={(e) => setUrlsInput(e.target.value)}
          placeholder={"https://www.amazon.com/dp/B0XXXXXXXX\nhttps://www.amazon.com/dp/B0YYYYYYYY"}
          rows={5}
        />
        <div className="actions-row">
          <button onClick={handleFetch} disabled={loading || urls.length === 0}>
            {loading ? "Fetching…" : `Fetch Reviews${urls.length ? ` (${urls.length})` : ""}`}
          </button>
          {error && <span className="error">{error}</span>}
        </div>
      </section>

      {results.length > 0 && (
        <section className="results-section">
          <div className="results-meta">
            {results.map((r) => (
              <div key={r.url} className={`product-chip ${r.error ? "product-chip-error" : ""}`}>
                <strong>{r.productTitle || r.asin || r.url}</strong>
                <span>
                  {r.error ? `Error: ${r.error}` : `${r.reviews.length} reviews (${r.source})`}
                </span>
              </div>
            ))}
          </div>

          <div className="table-toolbar">
            <label>
              Filter by product:{" "}
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                <option value="all">All products ({allReviews.length})</option>
                {results.map((r) => (
                  <option key={r.url} value={r.url}>
                    {r.productTitle || r.asin || r.url} ({r.reviews.length})
                  </option>
                ))}
              </select>
            </label>
            <div className="export-buttons">
              <button
                onClick={() => downloadCsv(filteredReviews)}
                disabled={filteredReviews.length === 0}
              >
                Export CSV
              </button>
              <button
                onClick={() => downloadPdf(filteredReviews)}
                disabled={filteredReviews.length === 0}
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Reviewer</th>
                  <th>Rating</th>
                  <th>Title</th>
                  <th>Body</th>
                  <th>Date</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviews.map((r, i) => (
                  <tr key={i}>
                    <td>{r.productTitle}</td>
                    <td>{r.reviewer}</td>
                    <td>{r.rating ?? "—"}</td>
                    <td>{r.title}</td>
                    <td className="body-cell">{r.body}</td>
                    <td>{r.date}</td>
                    <td>{r.verifiedPurchase ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
