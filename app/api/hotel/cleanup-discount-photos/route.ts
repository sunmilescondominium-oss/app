import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Called by Vercel cron every hour to purge expired government ID photos.
// Photos are kept for 48 hours after check-in, then deleted from storage
// and the path nulled on the stay row (Data Privacy Act compliance).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: expired } = await admin
    .from("stays")
    .select("id, discount_id_photo_path")
    .not("discount_id_photo_path", "is", null)
    .lt("discount_id_photo_expires_at", new Date().toISOString());

  if (!expired?.length) return NextResponse.json({ deleted: 0 });

  const paths = (expired as { id: string; discount_id_photo_path: string }[])
    .map((s) => s.discount_id_photo_path)
    .filter(Boolean);

  if (paths.length) {
    await admin.storage.from("discount-id-photos").remove(paths);
  }

  const ids = (expired as { id: string }[]).map((s) => s.id);
  await admin
    .from("stays")
    .update({ discount_id_photo_path: null, discount_id_photo_expires_at: null })
    .in("id", ids);

  return NextResponse.json({ deleted: paths.length, ids });
}
