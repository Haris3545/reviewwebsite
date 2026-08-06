import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReviewRecord } from "./types";

export function downloadPdf(reviews: ReviewRecord[], filename = "amazon-reviews.pdf") {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Amazon Reviews Export", 14, 15);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()} — ${reviews.length} reviews`, 14, 21);

  autoTable(doc, {
    startY: 26,
    head: [
      [
        "Product",
        "Reviewer",
        "Rating",
        "Title",
        "Body",
        "Date",
        "Verified",
      ],
    ],
    body: reviews.map((r) => [
      r.productTitle,
      r.reviewer,
      r.rating !== null ? String(r.rating) : "",
      r.title,
      r.body,
      r.date,
      r.verifiedPurchase ? "Yes" : "No",
    ]),
    styles: { fontSize: 7, cellWidth: "wrap" },
    columnStyles: {
      0: { cellWidth: 35 },
      4: { cellWidth: 90 },
    },
  });

  doc.save(filename);
}
