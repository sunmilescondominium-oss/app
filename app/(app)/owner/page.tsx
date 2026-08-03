import { requireModule } from "@/lib/auth/dal";
import { getOwnerSnapshot } from "@/lib/owner/queries";
import { listLeave } from "@/lib/employees/queries";
import { analyzeLeave } from "@/lib/employees/leave-analysis";
import { peso } from "@/lib/collections/summary";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { PrintButton } from "@/components/print-button";
import { PendingLeave } from "@/components/employees/pending-leave";

export const metadata = { title: "Owner Dashboard" };

/**
 * Owner Dashboard — deliberately large-text (≥18px), high-contrast, plain
 * language, minimal navigation, and print-to-PDF. Designed for an elderly user.
 */
export default async function OwnerPage() {
  await requireModule("owner");
  const s = await getOwnerSnapshot();

  const pending = await listLeave("pending");
  const leaveItems = await Promise.all(
    pending.map(async (req) => ({
      req,
      conflict:
        req.category === "leave" || req.category === "ob"
          ? await analyzeLeave({ userId: req.user_id, start_date: req.start_date, end_date: req.end_date })
          : null,
    })),
  );

  const cards = [
    { label: "Money collected this week", value: peso(s.weekTotal), tone: "text-emerald-700" },
    { label: "Collected today", value: peso(s.todayTotal), tone: "text-stone-900" },
    { label: "How full the properties are", value: `${s.occupancyPct}%`, sub: `${s.occupied} of ${s.totalUnits} units occupied`, tone: "text-stone-900" },
    { label: "Open issues to watch", value: String(s.openIssues), sub: s.escalated > 0 ? `${s.escalated} escalated` : "none escalated", tone: s.openIssues > 0 ? "text-amber-700" : "text-stone-900" },
  ];

  return (
    <div className="text-[18px] leading-relaxed text-stone-900">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Owner Weekly Overview</h1>
          <p className="mt-1 text-stone-600">
            {s.weekStart} to {s.today}
          </p>
        </div>
        <PrintButton label="Print for the Owner" />
      </div>

      {/* Print header */}
      <div className="mb-6 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-2xl font-bold">{APP_BRAND_SHORT}</p>
        <p>Owner Weekly Overview — {s.weekStart} to {s.today}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border-2 border-stone-200 bg-white p-6">
            <p className="text-stone-600">{c.label}</p>
            <p className={`mt-2 text-4xl font-bold tabular-nums ${c.tone}`}>{c.value}</p>
            {c.sub && <p className="mt-1 text-base text-stone-500">{c.sub}</p>}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
        <h2 className="text-2xl font-bold text-amber-900">Decisions that need you</h2>
        {s.decisions.length === 0 ? (
          <p className="mt-3 text-stone-700">Nothing needs your decision right now. Everything is on track.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {s.decisions.map((d) => (
              <li key={d} className="flex items-start gap-3">
                <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 rounded-2xl border-2 border-stone-200 bg-white p-6">
        <h2 className="text-2xl font-bold text-stone-900">
          Leave requests
          {leaveItems.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-3 py-0.5 align-middle text-lg text-amber-800">{leaveItems.length}</span>
          )}
        </h2>
        <p className="mt-1 text-base text-stone-500">Flags show where a leave would leave work uncovered. You can approve or reject.</p>
        <div className="mt-4 text-[15px] leading-normal">
          <PendingLeave items={leaveItems} canDecide />
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-stone-500">{APP_BRAND}</p>
    </div>
  );
}
