/** Shared result shape for bulk deactivate / delete actions. */
export type BulkResult =
  | { ok: true; affected: number; skipped: { id: string; reason: string }[] }
  | { ok: false; error: string };
