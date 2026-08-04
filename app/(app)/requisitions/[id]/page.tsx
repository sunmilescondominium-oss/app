import { notFound } from "next/navigation";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";
import { WorkflowActions } from "@/components/requisitions/workflow-actions";
import { listDocPhotos } from "@/lib/docs/photos";
import { peso } from "@/lib/collections/summary";
import {
  getRequisition, STATUS_LABEL, STATUS_TONE,
  ENDORSE_ROLES, BUDGET_ROLES, OWNER_ROLES, PURCHASE_ROLES, RECEIVE_ROLES,
} from "@/lib/requisitions/queries";

export default async function RequisitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireModule("requisitions");
  const data = await getRequisition(id);
  if (!data) notFound();
  const { req, items } = data;
  const photos = await listDocPhotos("requisition", id);

  const caps = {
    canEndorse: userHasAnyRole(user, ENDORSE_ROLES),
    canBudget: userHasAnyRole(user, BUDGET_ROLES),
    canOwner: userHasAnyRole(user, OWNER_ROLES),
    canPurchase: userHasAnyRole(user, PURCHASE_ROLES),
    canReceive: userHasAnyRole(user, RECEIVE_ROLES),
    canReject: userHasAnyRole(user, [...ENDORSE_ROLES, ...BUDGET_ROLES, ...OWNER_ROLES]),
  };

  const chain = [
    { label: "Requested", role: req.requestedByRole },
    { label: "Endorsed (Operations)", role: req.endorsedByRole },
    { label: "Budget (Accounting)", role: req.budgetByRole },
    { label: "Owner approval", role: req.ownerByRole },
    { label: "Purchased", role: req.purchasedByRole },
    { label: "Received", role: req.receivedByRole },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: "Requisitions & Purchasing", href: "/requisitions" }, { label: req.refNo ?? "Requisition" }]} />
      <PageHeader
        title={req.title}
        subtitle={`${req.refNo ?? ""} · ${req.businessLine ?? "—"}`}
        badge={<Badge tone={STATUS_TONE[req.status]}>{STATUS_LABEL[req.status]}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="py-2">Item</th>
                  <th className="py-2 text-right">Qty</th>
                  <th className="py-2 text-right">Est. cost</th>
                  <th className="py-2">Goes to</th>
                  <th className="py-2 text-right">Received</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-stone-100 last:border-0">
                    <td className="py-2 font-medium text-stone-800">{i.itemName}<span className="block text-xs text-stone-400">{i.category}</span></td>
                    <td className="py-2 text-right tabular-nums">{i.qty} {i.unitLabel}</td>
                    <td className="py-2 text-right tabular-nums">{peso(i.estUnitCost)}</td>
                    <td className="py-2 text-xs text-stone-500">{i.target === "room_supplies" ? "Housekeeping" : "Materials/tools"}</td>
                    <td className="py-2 text-right tabular-nums">{i.receivedQty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-sm">
              <span className="text-stone-500">Estimated total</span>
              <strong className="tabular-nums">{peso(req.estTotal)}</strong>
            </div>
            {req.actualTotal != null && (
              <div className="flex justify-between text-sm text-indigo-700">
                <span>Actual (purchased from {req.supplier ?? "—"})</span>
                <strong className="tabular-nums">{peso(req.actualTotal)}</strong>
              </div>
            )}
          </div>

          {(req.purpose || req.note) && (
            <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
              {req.purpose && <p><span className="font-medium text-stone-700">Purpose:</span> {req.purpose}</p>}
              {req.note && <p className="mt-1"><span className="font-medium text-stone-700">Note:</span> {req.note}</p>}
              {req.rejectReason && <p className="mt-1 text-red-600"><span className="font-medium">Rejected:</span> {req.rejectReason}</p>}
            </div>
          )}

          <PhotoDocPanel
            entity="requisition"
            entityId={id}
            kind="receipt"
            title="Receipt / OR (live photo)"
            label="Capture the supplier receipt or OR"
            canWrite={caps.canPurchase}
            photos={photos}
            canView={canReadModule(user.roleKeys, "media")}
          />
        </div>

        <div className="space-y-4">
          <WorkflowActions id={id} status={req.status} caps={caps} />
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            <h3 className="mb-3 font-semibold text-stone-800">Approval chain</h3>
            <ol className="space-y-2 text-sm">
              {chain.map((c) => (
                <li key={c.label} className="flex items-center justify-between">
                  <span className="text-stone-600">{c.label}</span>
                  {c.role ? <Badge tone="green">{c.role}</Badge> : <span className="text-xs text-stone-300">pending</span>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-stone-400">Roles are recorded, never individual names (RA 10173).</p>
          </div>
        </div>
      </div>
    </>
  );
}
