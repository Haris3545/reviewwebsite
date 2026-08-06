import type { ReviewRecord } from "./types";

const COLUMNS: { key: keyof ReviewRecord; label: string }[] = [
  { key: "productTitle", label: "Product" },
  { key: "asin", label: "ASIN" },
  { key: "reviewer", label: "Reviewer" },
  { key: "rating", label: "Rating" },
  { key: "title", label: "Review Title" },
  { key: "body", label: "Review Body" },
  { key: "date", label: "Date" },
  { key: "verifiedPurchase", label: "Verified Purchase" },
  { key: "helpfulVotes", label: "Helpful Votes" },
  { key: "productUrl", label: "Product URL" },
];

function escapeCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function reviewsToCsv(reviews: ReviewRecord[]): string {
  const header = COLUMNS.map((c) => escapeCell(c.label)).join(",");
  const rows = reviews.map((review) =>
    COLUMNS.map((c) => escapeCell(review[c.key])).join(","),
  );
  return [header, ...rows].join("\r\n");
}

export function downloadCsv(reviews: ReviewRecord[], filename = "amazon-reviews.csv") {
  const csv = reviewsToCsv(reviews);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
