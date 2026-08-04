export type ImportResult =
  | { ok: true; inserted: number; errors?: { row: number; error: string }[] }
  | { ok: false; error: string };
