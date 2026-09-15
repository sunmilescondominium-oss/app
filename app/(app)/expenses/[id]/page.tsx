import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getExpense } from "@/lib/expenses/queries";
import { VoucherPrint } from "@/components/voucher/voucher-print";
import { VoucherEditorBar } from "@/components/expenses/expense-forms";
import { Breadcrumb, PageHeader } from "@/components/ui";
import Link from "next/link";

export const metadata = { title: "Expense Voucher" };

export default async function ExpenseVoucherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reprint?: string }>;
}) {
  const { id } = await params;
  const { reprint } = await searchParams;
  await requireModule("expenses");
  const exp = await getExpense(id);
  if (!exp) notFound();

  const isReprint = reprint === "1";

  const date = new Date(exp.expense_date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });

  // Auto-description for the particulars (used when voucher_notes not set)
  const autoDescription = [exp.category_name, exp.description].filter(Boolean).join(" — ") || "Expense";

  // Source-of-funds label for the voucher
  const sourceOfFunds =
    exp.source === "bank"
      ? (exp.bank_account_label ?? "Bank Account")
      : exp.source === "petty_cash"
      ? (exp.fund_name ?? "Petty Cash Fund")
      : null;

  // The printed particulars use saved voucher_notes if set, otherwise auto-description
  const particularsText = exp.voucher_notes ?? autoDescription;
  const particulars = [{ description: particularsText, amount: exp.amount }];

  return (
    <>
      <div className="no-print">
        <Breadcrumb items={[{ label: "General Expenses", href: "/expenses" }, { label: "Voucher" }]} />
        <div className="flex items-center justify-between gap-3 mb-4">
          <PageHeader
            title={`Voucher ${exp.voucher_number ?? ""}`}
            subtitle={`${exp.vendor_name ?? "Expense"} · ${date}`}
          />
          <div className="flex gap-2">
            <Link
              href="/expenses"
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              ← Back
            </Link>
            {!isReprint && (
              <Link
                href={`/expenses/${id}?reprint=1`}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Reprint
              </Link>
            )}
          </div>
        </div>

        <VoucherEditorBar
          expenseId={id}
          initialNotes={exp.voucher_notes}
          autoDescription={autoDescription}
          isReprint={isReprint}
        />
      </div>

      <div className="mx-auto max-w-2xl print:max-w-none">
        <VoucherPrint
          data={{
            voucherNo: exp.voucher_number,
            rcNo: exp.or_number ?? exp.id.slice(0, 8).toUpperCase(),
            date,
            paidTo: exp.vendor_name ?? "",
            particulars,
            totalAmount: exp.amount,
            sourceOfFunds,
            checkNumber: exp.check_number,
            isReprint,
          }}
        />
      </div>
    </>
  );
}
