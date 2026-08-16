import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { getBankDepositConfigs } from "@/lib/collections/bank-config";
import { getActiveItemTypes } from "@/lib/collections/item-types";
import { PageHeader } from "@/components/ui";
import { BankConfigManager } from "@/components/admin/bank-config-manager";

export const metadata = { title: "Bank Deposit Config" };

export default async function BankConfigPage() {
  await requireModule("collections");

  const [configs, itemTypes] = await Promise.all([
    getBankDepositConfigs(),
    getActiveItemTypes(),
  ]);

  return (
    <>
      <div className="mb-4">
        <Link href="/admin" className="text-sm font-medium text-amber-700 hover:underline">
          ← Admin
        </Link>
      </div>

      <PageHeader
        title="Bank Deposit Configuration"
        subtitle="Accounting defines which bank each collection category deposits to, and what items are typically included."
      />

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">How this works</p>
        <ul className="list-disc pl-4 space-y-0.5 text-xs text-amber-800">
          <li>Each collection category is assigned to a bank account.</li>
          <li>The bank label appears on the collection entry form so staff always know where funds go.</li>
          <li>Default items are shown as a reference for what is typically deposited for each bank.</li>
          <li>Use <strong>+ Add custom item</strong> to include items not in the standard list.</li>
          <li>Changes take effect immediately — no deployment needed.</li>
        </ul>
      </div>

      <BankConfigManager configs={configs} itemTypes={itemTypes} />
    </>
  );
}
