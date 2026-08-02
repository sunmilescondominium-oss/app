import { createHash } from "node:crypto";

/**
 * Kiosk passcode hashing. The employee number is used as a salt so identical
 * passcodes across employees don't collide. Not a login password — it's a
 * short attendance PIN — but we still never store it in the clear.
 * TODO(client-confirm): move to a slow KDF (scrypt/argon2) if passcodes get long-lived.
 */
export function hashPasscode(employeeNo: string, passcode: string): string {
  return createHash("sha256").update(`${employeeNo.trim()}:${passcode.trim()}`).digest("hex");
}
