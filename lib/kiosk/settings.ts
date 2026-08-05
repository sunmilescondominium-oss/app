import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface KioskSettings {
  accessCode: string;
  showPhotos: boolean;
  /** Seconds the camera stays on per activation (normal hours). */
  cameraSeconds: number;
  /** Seconds the camera stays on during a rush window (arrival/departure). */
  cameraRushSeconds: number;
  /** Rush windows as "HH:MM-HH:MM" ranges, comma-separated (Manila time). */
  rushWindows: string;
  /** Hours a mobile-fallback window stays open before auto-expiring. */
  mobileFallbackHours: number;
}

export const KIOSK_COOKIE = "kiosk_session";

/** Cookie token proving a device passed the access-code gate. */
export function kioskToken(accessCode: string): string {
  return createHash("sha256").update(`kiosk:${accessCode}`).digest("hex").slice(0, 32);
}

export async function getKioskSettings(): Promise<KioskSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("kiosk_settings")
    .select("access_code, show_photos, camera_seconds, camera_rush_seconds, rush_windows, mobile_fallback_hours")
    .eq("id", 1)
    .maybeSingle();
  return {
    accessCode: (data?.access_code as string) ?? "",
    showPhotos: (data?.show_photos as boolean) ?? true,
    cameraSeconds: Number(data?.camera_seconds ?? 45),
    cameraRushSeconds: Number(data?.camera_rush_seconds ?? 180),
    rushWindows: (data?.rush_windows as string) ?? "06:00-09:00,16:00-19:00",
    mobileFallbackHours: Number(data?.mobile_fallback_hours ?? 4),
  };
}

/** True if this device may view the kiosk (no code set, or cookie matches). */
export function kioskUnlocked(accessCode: string, cookieValue: string | undefined): boolean {
  if (!accessCode) return true;
  return cookieValue === kioskToken(accessCode);
}
