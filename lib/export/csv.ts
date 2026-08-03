import "server-only";

/** Escape a single CSV cell (RFC 4180). */
function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build a CSV string from headers + rows. Prepends a UTF-8 BOM so Google
 * Sheets / Excel detect encoding correctly. Import into Google Sheets via
 * File → Import, or just open the downloaded file with Sheets.
 */
export function toCsv(headers: string[], rows: (unknown[])[]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  return "﻿" + lines.join("\r\n");
}

/** Standard Response for a CSV download. */
export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
