import { createHash } from "node:crypto";

export function hashGiftCardPin(cardCode: string, pin: string): string {
  return createHash("sha256").update(`${cardCode.trim().toUpperCase()}:${pin.trim()}`).digest("hex");
}

/** Generates a human-readable card code: GC-YYYY-NNN */
export function generateCardCode(year: number, sequence: number): string {
  return `GC-${year}-${String(sequence).padStart(3, "0")}`;
}
