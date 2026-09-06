/**
 * Small dependency-free CSV export helper - used wherever a screen
 * offers "Export CSV" (Students, Audit log, Assessment entry). Quotes
 * every field and doubles embedded quotes per RFC 4180, so names,
 * remarks, etc. with commas or quotes in them still round-trip
 * correctly into Excel/Google Sheets.
 */
function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  // A leading UTF-8 BOM so Excel (still the most common opener in a
  // school office) renders accented characters correctly instead of
  // guessing the wrong encoding.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
