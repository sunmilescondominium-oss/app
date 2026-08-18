import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToRoles } from "@/lib/push/sender";

export const dynamic = "force-dynamic";

const HOTEL_MONITORING_ROLES = ["hotel_rental_monitoring", "managing_officer", "admin"];
const HK_ROLES               = ["housekeeper_attendant", "managing_officer", "admin"];

interface AlarmBody {
  kind: "hotel_overdue" | "hk_start" | "hk_finish";
  id: string;
  unit: string;
  overByMin?: number;
}

/**
 * POST /api/push/alarm
 * Called by the client-side alarm components when they detect an overdue event.
 * Requires authentication (the page viewer triggers push for other role users).
 * Server-side 10-minute cooldown prevents duplicate pushes.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: AlarmBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { kind, id, unit, overByMin = 0 } = body;
  if (!kind || !id || !unit) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  let payload: { title: string; body: string; tag: string; url: string };
  let roles: string[];
  let eventKey: string;

  if (kind === "hotel_overdue") {
    payload = {
      title: `⚠️ Room ${unit} overdue checkout`,
      body: overByMin > 0
        ? `Guest is ${overByMin}m past checkout time. Please follow up.`
        : "Guest has passed their planned checkout time.",
      tag: `hotel_overdue_${id}`,
      url: `/hotel/${id}`,
    };
    roles = HOTEL_MONITORING_ROLES;
    eventKey = `hotel_overdue:${id}`;
  } else if (kind === "hk_start") {
    payload = {
      title: `🧹 Room ${unit} — cleaning not started`,
      body: overByMin > 0
        ? `${overByMin}m past the start deadline. Assign or begin cleaning now.`
        : "Start-by deadline has passed for this room.",
      tag: `hk_start_${id}`,
      url: `/housekeeping/${id}`,
    };
    roles = HK_ROLES;
    eventKey = `hk_start:${id}`;
  } else if (kind === "hk_finish") {
    payload = {
      title: `🧹 Room ${unit} — cleaning overdue`,
      body: overByMin > 0
        ? `${overByMin}m past expected finish time. Room may not be ready.`
        : "Cleaning completion deadline has passed.",
      tag: `hk_finish_${id}`,
      url: `/housekeeping/${id}`,
    };
    roles = HK_ROLES;
    eventKey = `hk_finish:${id}`;
  } else {
    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  const sent = await sendPushToRoles(roles, payload, eventKey, 10).catch(() => 0);
  return NextResponse.json({ ok: true, sent });
}
