import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOC_PHOTO_BUCKET, ENTITY_MODULE, type DocEntity } from "@/lib/docs/photos";

export const dynamic = "force-dynamic";

/** Auth-gated view of a documentation photo (module tied to the entity). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("doc_photos").select("entity, storage_path").eq("id", id).maybeSingle();
  if (!row) return new NextResponse("Not found", { status: 404 });

  const module = ENTITY_MODULE[row.entity as DocEntity];
  if (!module || !canReadModule(user.roleKeys, module)) return new NextResponse("Forbidden", { status: 403 });

  const { data: signed, error } = await admin.storage.from(DOC_PHOTO_BUCKET).createSignedUrl(row.storage_path as string, 60);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
