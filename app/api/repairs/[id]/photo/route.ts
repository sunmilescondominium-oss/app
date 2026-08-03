import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated view of a repair photo (?kind=report|before|after). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const kind = req.nextUrl.searchParams.get("kind");
  const column = kind === "before" ? "before_photo_path" : kind === "after" ? "after_photo_path" : "photo_path";

  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "repair")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: r } = await admin
    .from("repair_requests")
    .select(column)
    .eq("id", id)
    .maybeSingle();
  const path = (r as Record<string, string | null> | null)?.[column];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage
    .from("repair-photos")
    .createSignedUrl(path, 60);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not create link", { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
