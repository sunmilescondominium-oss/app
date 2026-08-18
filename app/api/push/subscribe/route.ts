import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** POST — save a new push subscription for the authenticated user. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { endpoint, keys } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // Upsert by endpoint so re-subscribing the same browser updates the row.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE — remove all push subscriptions for the authenticated user (opt-out). */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Optionally delete a specific endpoint if provided in body
  let endpoint: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    endpoint = (body as { endpoint?: string }).endpoint;
  } catch {
    // no body — delete all
  }

  const q = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) q.eq("endpoint", endpoint);
  const { error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
