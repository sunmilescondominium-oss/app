import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getExpense } from "@/lib/expenses/queries";
import { VoucherPrint } from "@/components/voucher/voucher-print";
import { PrintButton } from "@/components/print-button";
import { Breadcrumb, PageHeader } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Expense Voucher" };

export default async function ExpenseVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireModule("expenses");
  const exp = await getExpense(id);
  if (!exp) notFound();

  const date = new Date(exp.expense_date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
  const particularsLabel = [exp.category_name, exp.description].filter(Boolean).join(" — ");
  const particulars = [{ description: particularsLabel || "Expense", amount: exp.amount }];

  return (
    <>
      <div className="no-print">
        <Breadcrumb items={[{ label: "General Expenses", href: "/expenses" }, { label: "Voucher" }]} />
        <div className="flex items-center justify-between gap-3 mb-6">
          <PageHeader
            title="Expense Voucher"
            subtitle={`${exp.vendor_name ?? "Expense"} · ${date}`}
          />
          <div className="flex gap-2">
            <Link href="/expenses" className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              ← Back
            </Link>
            <PrintButton label="Print voucher" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl print:max-w-none">
        <VoucherPrint
          data={{
            rcNo: exp.or_number ?? exp.id.slice(0, 8).toUpperCase(),
            date,
            paidTo: exp.vendor_name ?? "",
            particulars,
            totalAmount: exp.amount,
          }}
        />
      </div>
    </>
  );
}
