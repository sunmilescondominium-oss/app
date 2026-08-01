import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated view of an attendance photo — the record owner or an HR role. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind") === "out" ? "out" : "in";

  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: rec } = await admin
    .from("time_records")
    .select("user_id, time_in_photo, time_out_photo")
    .eq("id", id)
    .maybeSingle();
  if (!rec) return new NextResponse("Not found", { status: 404 });

  const isOwner = rec.user_id === user.userId;
  if (!isOwner && !canReadModule(user.roleKeys, "hr")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const path = (kind === "out" ? rec.time_out_photo : rec.time_in_photo) as string | null;
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage
    .from("attendance-photos")
    .createSignedUrl(path, 60);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not create link", { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
