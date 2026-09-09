import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getPettyCashDisbursement } from "@/lib/petty-cash/queries";
import { VoucherPrint } from "@/components/voucher/voucher-print";
import { PrintButton } from "@/components/print-button";
import { Breadcrumb, PageHeader } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Petty Cash Voucher" };

export default async function PcvPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireModule("petty_cash");
  const txn = await getPettyCashDisbursement(id);
  if (!txn) notFound();

  const date = new Date(txn.created_at).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
  const particulars = [
    { description: txn.description ?? "Petty cash disbursement", amount: txn.amount },
  ];

  return (
    <>
      <div className="no-print">
        <Breadcrumb items={[{ label: "Petty Cash", href: "/petty-cash" }, { label: txn.pcv_no ?? "Voucher" }]} />
        <div className="flex items-center justify-between gap-3 mb-6">
          <PageHeader
            title={txn.pcv_no ? `PCV ${txn.pcv_no}` : "Petty Cash Voucher"}
            subtitle={`${txn.fund_name}${txn.vendor_name ? ` · ${txn.vendor_name}` : ""}`}
          />
          <div className="flex gap-2">
            <Link href="/petty-cash" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              ← Back
            </Link>
            <PrintButton label="Print voucher" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl print:max-w-none">
        <VoucherPrint
          data={{
            rcNo: txn.pcv_no ?? txn.id.slice(0, 8).toUpperCase(),
            date,
            paidTo: txn.vendor_name ?? "",
            particulars,
            totalAmount: txn.amount,
          }}
        />
      </div>
    </>
  );
}
