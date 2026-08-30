import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { listGuardAccounts } from "@/lib/guard/queries";
import { PageHeader, Badge } from "@/components/ui";
import { GuardAccountEditor } from "./guard-account-editor";

export const metadata = { title: "Guard Accounts" };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
  });
}

export default async function GuardAccountsPage() {
  const user = await requireModule("guard");
  const canManage = userHasAnyRole(user, ["admin", "managing_officer", "consultant"]);
  if (!canManage) {
    return (
      <>
        <PageHeader backHref="/guard" title="Guard Accounts" />
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          Access restricted to administrators.
        </div>
      </>
    );
  }

  const guards = await listGuardAccounts();

  return (
    <>
      <PageHeader
        backHref="/guard"
        title="Guard Accounts"
        subtitle="Contract status, agency details, NDA acknowledgment"
        badge={<Badge>{guards.length} guard{guards.length !== 1 ? "s" : ""}</Badge>}
      />

      {/* Warn about unassigned operation types */}
      {(() => {
        const unassigned = guards.filter((g) => !g.guardOperation);
        return unassigned.length > 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">
              {unassigned.length} guard{unassigned.length !== 1 ? "s" : ""} unassigned:
            </span>{" "}
            {unassigned.map((g) => g.displayLabel).join(", ")} — click Edit to set their operation area (Hotel or Condo).
          </div>
        ) : null;
      })()}

      {guards.length === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-400">
          No guard accounts found. Assign the "guard" role to a user to add them here.
        </div>
      )}

      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white overflow-hidden">
        {guards.map((g) => (
          <div key={g.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-stone-800">{g.displayLabel}</span>
                {g.guardOperation === "hotel" && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    Hotel Ops
                  </span>
                )}
                {g.guardOperation === "condo" && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Condo Ops
                  </span>
                )}
                {!g.guardOperation && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-400">
                    Unassigned
                  </span>
                )}
                {g.isExpired && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    Expired
                  </span>
                )}
                {!g.guardNdaAcknowledgedAt && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    NDA pending
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                {g.guardAgency ? `${g.guardAgency}` : "No agency set"}
                {g.guardPosition ? ` · ${g.guardPosition}` : ""}
              </p>
              <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-stone-400">
                {g.guardContractExpiresAt && (
                  <span>
                    Contract expires: {fmtDate(g.guardContractExpiresAt)}
                  </span>
                )}
                {g.guardNdaAcknowledgedAt && (
                  <span>NDA ack'd: {fmtDate(g.guardNdaAcknowledgedAt)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/guard/letter/${g.userId}`}
                target="_blank"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Print letter
              </Link>
              <GuardAccountEditor guard={g} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
