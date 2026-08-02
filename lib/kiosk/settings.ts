import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface KioskSettings {
  accessCode: string;
  showPhotos: boolean;
}

export const KIOSK_COOKIE = "kiosk_session";

/** Cookie token proving a device passed the access-code gate. */
export function kioskToken(accessCode: string): string {
  return createHash("sha256").update(`kiosk:${accessCode}`).digest("hex").slice(0, 32);
}

export async function getKioskSettings(): Promise<KioskSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("kiosk_settings").select("access_code, show_photos").eq("id", 1).maybeSingle();
  return {
    accessCode: (data?.access_code as string) ?? "",
    showPhotos: (data?.show_photos as boolean) ?? true,
  };
}

/** True if this device may view the kiosk (no code set, or cookie matches). */
export function kioskUnlocked(accessCode: string, cookieValue: string | undefined): boolean {
  if (!accessCode) return true;
  return cookieValue === kioskToken(accessCode);
}
