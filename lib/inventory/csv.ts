import { CSV_HEADERS } from "./types";

/**
 * Minimal, dependency-free CSV parser. Handles quoted fields, escaped quotes
 * ("" inside quotes), and CRLF/CR line endings. Client-safe (pure).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse into header-keyed objects (headers lowercased, values trimmed). */
export function csvToObjects(text: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const matrix = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const rows = matrix.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cells[i] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

/** A ready-to-download example template so users know the expected columns. */
export function buildTemplateCsv(): string {
  const header = [...CSV_HEADERS].join(",");
  const rows = [
    ["Block H", "H01", "1BR", "1", "28.5", "rental", "", "available"],
    ["RFO Tower", "310", "Studio", "3", "20.4", "condo_sales", "2500000", "available"],
    ["SMiles Hotel", "Deluxe-201", "Deluxe", "2", "26", "hotel", "", "available"],
  ];
  return [header, ...rows.map((r) => r.join(","))].join("\n") + "\n";
}
