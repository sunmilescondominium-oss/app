import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendAlert } from "@/lib/alerts/sendAlert";

export const dynamic = "force-dynamic";

/**
 * 6:00 PM check: alert if no cash transmittal has been submitted for today.
 * Schedule it with a cron (see vercel.json / SETUP.md). Protected by CRON_SECRET
 * — sent by Vercel Cron automatically as a Bearer token, or pass ?key=<secret>.
 */
function authorized(req: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false; // must be configured to run
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(
    new Date(),
  );

  const { data: tx } = await admin
    .from("transmittals")
    .select("id")
    .eq("transmittal_date", today)
    .in("status", ["submitted", "deposited", "reconciled"])
    .limit(1);

  if ((tx?.length ?? 0) > 0) {
    return NextResponse.json({ ok: true, submitted: true, date: today });
  }

  const { count } = await admin
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("collected_on", today);

  const alert = await sendAlert({
    subject: `⚠️ Daily collections summary not submitted — ${today}`,
    body:
      `No cash transmittal has been submitted for ${today} as of the 6:00 PM check.\n` +
      `Collections recorded today: ${count ?? 0}.\n` +
      `Please prepare and submit the daily transmittal.`,
  });

  return NextResponse.json({ ok: true, submitted: false, date: today, alert });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
