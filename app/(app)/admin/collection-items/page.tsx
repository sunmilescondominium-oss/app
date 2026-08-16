import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { getAllItemTypes } from "@/lib/collections/item-types";
import { PageHeader } from "@/components/ui";
import { CollectionItemManager } from "@/components/admin/collection-item-manager";

export const metadata = { title: "Collection Items" };

export default async function CollectionItemsPage() {
  const user = await requireAuth();
  const canEdit = userHasAnyRole(user, ["accounting", "admin", "managing_officer", "consultant"]);
  if (!canEdit) throw new Error("Access denied.");

  const items = await getAllItemTypes();

  return (
    <>
      <div className="mb-4">
        <Link href="/admin" className="text-sm font-medium text-amber-700 hover:underline">
          ← Admin
        </Link>
      </div>

      <PageHeader
        title="Collection Item Types"
        subtitle="Accounting defines what can be collected and how it is categorized. Staff see only these items in the collection form."
      />

      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/40 p-4 text-xs text-sky-900 space-y-1">
        <p className="font-semibold text-sm">How this works</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>Each item has a <strong>key</strong> (auto-generated, permanent) and a <strong>label</strong> (editable anytime).</li>
          <li>The <strong>group</strong> controls which section the item appears under in the collection form dropdown.</li>
          <li>Set an item <strong>Inactive</strong> to hide it from new collections — past records are not affected.</li>
          <li>New items added here appear immediately in the collection form and bank config checkboxes.</li>
        </ul>
      </div>

      <CollectionItemManager items={items} />
    </>
  );
}
