import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { VoucherPrint } from "@/components/voucher/voucher-print";
import { getPayableVoucher } from "@/lib/payables/queries";
import { PAYABLE_TYPES, PAYABLE_STATUS_TONE } from "@/lib/payables/types";

const TYPE_LABEL = Object.fromEntries(PAYABLE_TYPES.map((t) => [t.key, t.label]));

export default async function PayableVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireModule("payables");
  const p = await getPayableVoucher(id);
  if (!p) notFound();

  const date = new Date(p.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric" });
  const typeLabel = TYPE_LABEL[p.ptype] ?? p.ptype;
  const particulars = [
    { description: [typeLabel, p.businessLine, p.description].filter(Boolean).join(" — "), amount: p.amount },
  ];

  return (
    <>
      <div className="no-print">
        <Breadcrumb items={[{ label: "Commissions & Payables", href: "/payables" }, { label: "Voucher" }]} />
        <div className="flex items-center justify-between gap-3 mb-6">
          <PageHeader
            title="Payment Voucher"
            subtitle={`${typeLabel} · ${p.payeeName}`}
            badge={<Badge tone={PAYABLE_STATUS_TONE[p.status] ?? "slate"}>{p.status}</Badge>}
          />
          <PrintButton label="Print voucher" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl print:max-w-none">
        <VoucherPrint
          data={{
            rcNo: p.refNo ?? p.id.slice(0, 8).toUpperCase(),
            date,
            paidTo: p.payeeName,
            paidToAddress: "",
            particulars,
            totalAmount: p.amount,
          }}
        />
      </div>
    </>
  );
}
