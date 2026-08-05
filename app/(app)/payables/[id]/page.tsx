import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { getPayableVoucher } from "@/lib/payables/queries";
import { PAYABLE_TYPES, PAYABLE_STATUS_TONE } from "@/lib/payables/types";
import { peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";

const TYPE_LABEL = Object.fromEntries(PAYABLE_TYPES.map((t) => [t.key, t.label]));

export default async function PayableVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireModule("payables");
  const p = await getPayableVoucher(id);
  if (!p) notFound();

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between border-b border-stone-100 py-1.5 text-sm"><span className="text-stone-500">{k}</span><span className="text-right font-medium text-stone-800">{v}</span></div>
  );

  return (
    <>
      <div className="no-print">
        <Breadcrumb items={[{ label: "Commissions & Payables", href: "/payables" }, { label: "Voucher" }]} />
        <div className="flex items-center justify-between gap-3">
          <PageHeader title="Payment voucher" subtitle={`${TYPE_LABEL[p.ptype] ?? p.ptype} · ${p.payeeName}`} badge={<Badge tone={PAYABLE_STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>} />
          <PrintButton label="Print voucher" />
        </div>
      </div>

      <div className="mx-auto max-w-xl rounded-2xl border border-stone-200 bg-white p-6 print:border-0 print:p-0">
        <div className="mb-4 border-b border-stone-300 pb-3 text-center">
          <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
          <p className="text-sm font-semibold">PAYMENT VOUCHER</p>
          <p className="text-xs text-stone-500">Ref: {p.refNo ?? p.id.slice(0, 8)} · {new Date(p.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</p>
        </div>

        {row("Payee", `${p.payeeName} (${p.payeeKind})`)}
        {p.payeeTin && row("TIN", p.payeeTin)}
        {row("Type", TYPE_LABEL[p.ptype] ?? p.ptype)}
        {p.businessLine && row("Business line", p.businessLine)}
        {p.description && row("Particulars", p.description)}
        {row("Amount", <span className="text-lg">{peso(p.amount)}</span>)}
        {p.status === "released" && row("Released", `${p.releaseMethod ?? "—"} · ${p.releaseOrNo ?? "—"}`)}

        <div className="mt-10 grid grid-cols-3 gap-4 text-center text-xs">
          <div><div className="mb-1 border-t border-stone-800 pt-1">Prepared by</div></div>
          <div><div className="mb-1 border-t border-stone-800 pt-1">Approved by</div></div>
          <div><div className="mb-1 border-t border-stone-800 pt-1">Received by (payee)</div></div>
        </div>
      </div>
    </>
  );
}
