import "server-only";
import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

export const LANG_COOKIE = "lang";

/** The current UI language from the cookie (defaults to English). */
export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "fil" ? "fil" : "en";
}
