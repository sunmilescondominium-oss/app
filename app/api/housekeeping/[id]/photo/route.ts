import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated view of a housekeeping photo (Housekeeping readers). ?i=index */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = Number(req.nextUrl.searchParams.get("i") ?? "0");

  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "housekeeping")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin.from("housekeeping_tasks").select("photos").eq("id", id).maybeSingle();
  const photos = Array.isArray(data?.photos) ? (data!.photos as string[]) : [];
  const path = photos[i];
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage.from("housekeeping-photos").createSignedUrl(path, 120);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
