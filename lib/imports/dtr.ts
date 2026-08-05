// CSV headers + template for bulk DTR (time records) upload into payroll.
// Times are 24-hour HH:MM in Manila time; date is YYYY-MM-DD. time_out may be
// left blank for an still-open day.

export const DTR_HEADERS = ["employee_no", "date", "time_in", "time_out"] as const;

export const DTR_TEMPLATE =
  DTR_HEADERS.join(",") + "\n" +
  "1001,2026-08-01,08:00,17:00\n" +
  "1002,2026-08-01,08:15,17:05\n" +
  "1001,2026-08-02,08:00,12:00\n" +
  "# date: YYYY-MM-DD · time_in/time_out: 24-hour HH:MM (Manila) · leave time_out blank if still open\n" +
  "# new dates import directly; a date that already has a DIFFERENT system record is flagged for accounting/admin to overwrite\n";

export type DtrImportResult =
  | {
      ok: true;
      inserted: number;
      overwritten: number;
      unchanged: number;
      conflicts: { row: number; error: string }[];
      invalid: { row: number; error: string }[];
      needsOverwrite: boolean;
      canOverwrite: boolean;
    }
  | { ok: false; error: string };
