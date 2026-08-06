import { useEffect, useMemo, useState } from "react";
import type { ProductResult, ReviewsResponse, SearchResponse, SearchResultItem } from "../lib/types";
import { downloadCsv } from "../lib/csv";
import { downloadPdf } from "../lib/pdf";
import { createProject, getProject, updateProject } from "../lib/projectsApi";
import { useLoadingStages } from "../lib/useLoadingStages";
import LoadingBar from "../components/LoadingBar";
import Diagnostics from "../components/Diagnostics";

const DOMAINS = [
  { value: "amazon.co.uk", label: "amazon.co.uk" },
  { value: "amazon.com", label: "amazon.com" },
];

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

export default function HomePage() {
  const [mode, setMode] = useState<"search" | "links">("search");

  const [urlsInput, setUrlsInput] = useState("");
  const [results, setResults] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchDomain, setSearchDomain] = useState(DOMAINS[0].value);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [selectedAsins, setSelectedAsins] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const urls = useMemo(() => parseUrls(urlsInput), [urlsInput]);
  const allReviews = useMemo(() => results.flatMap((r) => r.reviews), [results]);
  const filteredReviews = useMemo(() => {
    if (productFilter === "all") return allReviews;
    return allReviews.filter((r) => r.productUrl === productFilter);
  }, [allReviews, productFilter]);

  const {
    progress: loadingProgress,
    text: loadingText,
    secondsRemaining: loadingSecondsRemaining,
  } = useLoadingStages(loading, loadingComplete);

  const diagnostics = [
    error && { label: "Fetch reviews", message: error },
    searchError && { label: "Search", message: searchError },
    saveError && { label: "Save project", message: saveError },
  ].filter((d): d is { label: string; message: string } => Boolean(d));

  // Deep-link from the Projects page: /?project=<id> loads a saved project
  // back into the form so it can be reviewed or re-fetched and updated.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (!id) return;
    getProject(id)
      .then((project) => {
        setCurrentProjectId(project.id);
        setProjectName(project.name);
        setMode(project.mode);
        setUrlsInput(project.urls.join("\n"));
        setSearchQuery(project.searchQuery ?? "");
        if (project.searchDomain) setSearchDomain(project.searchDomain);
        setResults(project.results);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load project."));
  }, []);

  async function fetchReviewsForUrls(targetUrls: string[]) {
    if (targetUrls.length === 0) {
      setError("Add at least one Amazon product link.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setSavedMessage(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: targetUrls }),
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
      setLoadingComplete(true);
      await new Promise((r) => setTimeout(r, 350));
      setLoading(false);
      setLoadingComplete(false);
    }
  }

  async function handleSearch() {
    if (searchQuery.trim().length === 0) {
      setSearchError("Enter a search term, e.g. \"delonghi heaters\".");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSelectedAsins(new Set());
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), domain: searchDomain }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }
      const data: SearchResponse = await res.json();
      setSearchResults(data.items);
      setSelectedAsins(new Set(data.items.map((i) => i.asin)));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSearching(false);
    }
  }

  function toggleAsin(asin: string) {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) next.delete(asin);
      else next.add(asin);
      return next;
    });
  }

  function handleFetchFromSearch() {
    const selectedUrls = searchResults
      .filter((item) => selectedAsins.has(item.asin))
      .map((item) => item.url);
    fetchReviewsForUrls(selectedUrls);
  }

  async function handleSaveConfirm() {
    if (projectName.trim().length === 0) {
      setSaveError("Give the project a name.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const project = await createProject({
        name: projectName.trim(),
        mode,
        urls: mode === "links" ? urls : results.map((r) => r.url),
        searchQuery: mode === "search" ? searchQuery.trim() : null,
        searchDomain: mode === "search" ? searchDomain : null,
        results,
      });
      setCurrentProjectId(project.id);
      setShowSaveForm(false);
      setSavedMessage(`Saved as “${project.name}”.`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save project.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProject() {
    if (!currentProjectId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const project = await updateProject(currentProjectId, {
        urls: mode === "links" ? urls : results.map((r) => r.url),
        searchQuery: mode === "search" ? searchQuery.trim() : null,
        searchDomain: mode === "search" ? searchDomain : null,
        results,
      });
      setSavedMessage(`Updated “${project.name}”.`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not update project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <header>
        <p className="eyebrow">Amazon reviews, extracted</p>
        <h1>
          Turn any listing into a <span className="highlight">review</span> spreadsheet
        </h1>
        <p className="subtitle">
          Paste product links, or search a brand or category, to pull reviews into a table you
          can export as CSV or PDF.
        </p>
      </header>

      <nav className="mode-tabs">
        <button
          className={mode === "search" ? "tab active" : "tab"}
          onClick={() => setMode("search")}
        >
          Search by keyword
        </button>
        <button
          className={mode === "links" ? "tab active" : "tab"}
          onClick={() => setMode("links")}
        >
          Paste links
        </button>
      </nav>

      {mode === "links" && (
        <section className="input-section">
          <textarea
            value={urlsInput}
            onChange={(e) => setUrlsInput(e.target.value)}
            placeholder={"https://www.amazon.co.uk/dp/B0XXXXXXXX\nhttps://www.amazon.com/dp/B0YYYYYYYY"}
            rows={5}
          />
          <div className="actions-row">
            <button
              className="primary"
              onClick={() => fetchReviewsForUrls(urls)}
              disabled={loading || urls.length === 0}
            >
              {loading ? "Fetching…" : `Fetch reviews${urls.length ? ` (${urls.length})` : ""}`}
            </button>
          </div>
          {loading && (
            <LoadingBar
              progress={loadingProgress}
              text={loadingText}
              secondsRemaining={loadingSecondsRemaining}
            />
          )}
        </section>
      )}

      {mode === "search" && (
        <section className="input-section">
          <div className="search-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='e.g. "delonghi heaters"'
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <select value={searchDomain} onChange={(e) => setSearchDomain(e.target.value)}>
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <button onClick={handleSearch} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          <p className="hint">
            Matches products by what they actually are, not just the words in the title — so a
            search for "delonghi heaters" also picks up listings without "heater" in the name.
          </p>

          {searchResults.length > 0 && (
            <div className="search-results">
              <ul className="search-list">
                {searchResults.map((item) => (
                  <li key={item.asin}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedAsins.has(item.asin)}
                        onChange={() => toggleAsin(item.asin)}
                      />
                      <span className="search-item-title">{item.title || item.asin}</span>
                      <span className="search-item-meta">
                        {item.stars ? `${item.stars}★` : ""}
                        {item.reviewsCount ? ` · ${item.reviewsCount} reviews` : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="actions-row">
                <button
                  className="primary"
                  onClick={handleFetchFromSearch}
                  disabled={loading || selectedAsins.size === 0}
                >
                  {loading ? "Fetching…" : `Fetch reviews for selected (${selectedAsins.size})`}
                </button>
              </div>
              {loading && (
                <LoadingBar
                  progress={loadingProgress}
                  text={loadingText}
                  secondsRemaining={loadingSecondsRemaining}
                />
              )}
            </div>
          )}
        </section>
      )}

      {results.length > 0 && (
        <section className="results-section">
          <div className="results-meta">
            {results.map((r) => (
              <div key={r.url} className={`chip ${r.error ? "chip-error" : ""}`}>
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

          <div className="save-row">
            {currentProjectId ? (
              <button onClick={handleUpdateProject} disabled={saving}>
                {saving ? "Updating…" : "Update project"}
              </button>
            ) : showSaveForm ? (
              <div className="save-form">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  onKeyDown={(e) => e.key === "Enter" && handleSaveConfirm()}
                  autoFocus
                />
                <button className="primary" onClick={handleSaveConfirm} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setShowSaveForm(false)} disabled={saving}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSaveForm(true)}>Save as project</button>
            )}
            {savedMessage && (
              <span className="save-confirm">
                {savedMessage} <a href="/projects">View in Projects</a>
              </span>
            )}
          </div>
        </section>
      )}

      <Diagnostics items={diagnostics} />
    </>
  );
}
