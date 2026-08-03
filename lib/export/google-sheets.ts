import "server-only";

/**
 * Direct Google Sheets sync (Phase 2 of "export to Google Sheets").
 *
 * The CSV export (lib/export/csv.ts + /api/export/*) already works today and
 * opens directly in Google Sheets. This module is the wiring point for pushing
 * a report straight into a Google Sheet, which needs credentials from the
 * client:
 *
 *   TODO(client-confirm): provide a Google Cloud **service account** with the
 *   Google Sheets API enabled, share the target spreadsheet with the service
 *   account email, then set env vars:
 *     GOOGLE_SERVICE_ACCOUNT_EMAIL
 *     GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY   (escaped \n)
 *     GSHEETS_SPREADSHEET_ID
 *
 * Once set, install `googleapis` and implement writeSheet() below (append rows
 * to a named tab). Until then this throws a clear, actionable error so callers
 * can fall back to the CSV download.
 */

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GSHEETS_SPREADSHEET_ID,
  );
}

export async function writeSheet(_tab: string, _headers: string[], _rows: unknown[][]): Promise<never> {
  throw new Error(
    "Direct Google Sheets sync is not configured yet. Provide a Google service account (see lib/export/google-sheets.ts) or use the CSV export, which opens in Google Sheets.",
  );
}
