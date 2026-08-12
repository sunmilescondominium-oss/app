import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { unitBill } from "@/lib/rentals/queries";
import { peso, todayManila } from "@/lib/collections/summary";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Reminder Letter" };

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ReminderLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  await requireModule("rentals");
  const { unitId } = await params;
  const { type = "combined" } = await searchParams;

  const bill = await unitBill(unitId);
  if (!bill) notFound();
  const { unit, lines, utilityLines, total } = bill;

  const today = todayManila();
  const dueIn5 = addDays(today, 5);
  const tenantName = unit.lease?.tenantLabel ?? "Tenant";
  const allLines = [...lines, ...utilityLines];

  // Separate billing: show rent+dues in one section, utilities in another
  const isSeparate = type === "separate";

  return (
    <>
      {/* Controls — no-print */}
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/rentals/${unitId}`} className="text-xs text-amber-700 hover:underline">← Back to unit</Link>
        <Link href={`/rentals/${unitId}/bill`} className="text-xs text-stone-500 hover:underline">Billing statement</Link>
        <span className="text-xs text-stone-300">|</span>
        <span className="text-xs font-medium text-stone-500">Letter type:</span>
        <Link
          href={`/rentals/${unitId}/letter?type=combined`}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${type !== "separate" ? "bg-amber-600 text-white" : "border border-stone-300 text-stone-600 hover:bg-stone-50"}`}
        >
          Combined
        </Link>
        <Link
          href={`/rentals/${unitId}/letter?type=separate`}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${type === "separate" ? "bg-amber-600 text-white" : "border border-stone-300 text-stone-600 hover:bg-stone-50"}`}
        >
          Separate (rent + utilities)
        </Link>
        <PrintButton label="Print letter" />
      </div>

      {/* ── Combined letter ─────────────────────────────────────────── */}
      {!isSeparate && (
        <LetterShell>
          <Letterhead propertyName={unit.propertyName} today={today} />
          <Recipient tenantName={tenantName} contact={unit.lease?.contact} unitNumber={unit.unitNumber} />
          <p className="mt-4 leading-relaxed text-stone-700">
            Dear <strong>{tenantName}</strong>,
          </p>
          <p className="mt-3 leading-relaxed text-stone-700">
            This is a friendly reminder that the following charges for{" "}
            <strong>Unit {unit.unitNumber}</strong> at <strong>{unit.propertyName}</strong> are
            due or will be due on <strong>{dueIn5}</strong>. Kindly settle the outstanding
            balance at the earliest convenience.
          </p>

          <table className="mt-5 w-full text-sm">
            <thead className="border-b border-stone-300 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="py-2 text-left">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allLines.length === 0 && (
                <tr><td colSpan={2} className="py-4 text-center text-stone-400">No outstanding charges.</td></tr>
              )}
              {allLines.map((l, i) => (
                <tr key={i} className="border-b border-stone-100">
                  <td className="py-2">
                    {l.label}
                    {l.detail && <span className="ml-1 text-xs text-stone-400">({l.detail})</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{peso(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="pt-3">Total amount due</td>
                <td className="pt-3 text-right tabular-nums">{peso(total)}</td>
              </tr>
            </tfoot>
          </table>

          <PaymentNote />
          <Signature />
        </LetterShell>
      )}

      {/* ── Separate letters (printed one after the other) ──────────── */}
      {isSeparate && (
        <>
          {/* Letter 1: Rent & dues */}
          <LetterShell>
            <Letterhead propertyName={unit.propertyName} today={today} />
            <Recipient tenantName={tenantName} contact={unit.lease?.contact} unitNumber={unit.unitNumber} />
            <p className="mt-4 leading-relaxed text-stone-700">
              Dear <strong>{tenantName}</strong>,
            </p>
            <p className="mt-3 leading-relaxed text-stone-700">
              This is a reminder of your <strong>rental dues</strong> for Unit {unit.unitNumber}
              at {unit.propertyName}. Please settle the balance below on or before{" "}
              <strong>{dueIn5}</strong>.
            </p>
            <table className="mt-5 w-full text-sm">
              <thead className="border-b border-stone-300 text-xs uppercase tracking-wide text-stone-500">
                <tr><th className="py-2 text-left">Description</th><th className="py-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {lines.length === 0 && (
                  <tr><td colSpan={2} className="py-4 text-center text-stone-400">No outstanding rent or dues.</td></tr>
                )}
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-2">{l.label}{l.detail && <span className="ml-1 text-xs text-stone-400">({l.detail})</span>}</td>
                    <td className="py-2 text-right tabular-nums">{peso(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="pt-3">Total</td>
                  <td className="pt-3 text-right tabular-nums">{peso(lines.reduce((s, l) => s + l.amount, 0))}</td>
                </tr>
              </tfoot>
            </table>
            <PaymentNote />
            <Signature />
          </LetterShell>

          {/* Letter 2: Utilities */}
          {utilityLines.length > 0 && (
            <LetterShell className="mt-8 print:mt-0 print:break-before-page">
              <Letterhead propertyName={unit.propertyName} today={today} subject="Utility Bill Notice" />
              <Recipient tenantName={tenantName} contact={unit.lease?.contact} unitNumber={unit.unitNumber} />
              <p className="mt-4 leading-relaxed text-stone-700">
                Dear <strong>{tenantName}</strong>,
              </p>
              <p className="mt-3 leading-relaxed text-stone-700">
                Please find below the <strong>utility charges</strong> for Unit {unit.unitNumber}
                at {unit.propertyName} based on the latest meter readings. Payment is due by{" "}
                <strong>{dueIn5}</strong>.
              </p>
              {unit.meralcoCan && (
                <p className="mt-2 text-xs text-stone-500">
                  Meralco CAN: <span className="font-mono">{unit.meralcoCan}</span>
                  {unit.waterAccountNo && (
                    <> &nbsp;·&nbsp; Water account: <span className="font-mono">{unit.waterAccountNo}</span></>
                  )}
                </p>
              )}
              <table className="mt-5 w-full text-sm">
                <thead className="border-b border-stone-300 text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="py-2 text-left">Utility</th><th className="py-2 text-right">Amount</th></tr>
                </thead>
                <tbody>
                  {utilityLines.map((l, i) => (
                    <tr key={i} className="border-b border-stone-100">
                      <td className="py-2">{l.label}{l.detail && <span className="ml-1 text-xs text-stone-400">({l.detail})</span>}</td>
                      <td className="py-2 text-right tabular-nums">{peso(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="pt-3">Total</td>
                    <td className="pt-3 text-right tabular-nums">{peso(utilityLines.reduce((s, l) => s + l.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
              <PaymentNote />
              <Signature />
            </LetterShell>
          )}
        </>
      )}

      {/* Notification strategy callout — no-print */}
      <div className="no-print mt-8 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <p className="mb-3 font-semibold text-sky-900">Sending this reminder to the tenant</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StrategyCard
            icon="💬"
            title="WhatsApp"
            recommended
            detail="Highest open rate in the Philippines. Copy the letter text or share a screenshot. Free via the app."
          />
          <StrategyCard
            icon="📧"
            title="Email"
            detail="Best for formal statements. Print to PDF and attach, or paste the text. Works well for tenants with corporate billing."
          />
          <StrategyCard
            icon="🔗"
            title="Tenant portal"
            detail="Tenant views their bill at any time via their portal PIN. Share the link or QR. No action needed — bill is always current."
          />
          <StrategyCard
            icon="📱"
            title="SMS"
            detail="Backup channel when WhatsApp isn't available. Keep it short: unit, amount, due date. Use a bulk-SMS gateway for many tenants."
          />
        </div>
        <p className="mt-4 text-xs text-sky-700">
          Recommended flow: Print or PDF this letter → share on WhatsApp → confirm receipt. For mass reminders (10+ tenants), use an SMS gateway (e.g., Semaphore, Itexmo) or a WhatsApp Business API batch.
        </p>
      </div>
    </>
  );
}

function LetterShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-8 print:border-0 print:p-0 print:shadow-none ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Letterhead({ propertyName, today, subject = "Billing Statement / Payment Reminder" }: { propertyName: string; today: string; subject?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-stone-300 pb-4">
      <div>
        <p className="text-lg font-bold tracking-tight text-stone-900">{APP_BRAND_SHORT}</p>
        <p className="text-sm text-stone-500">{propertyName}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-700">{subject}</p>
      </div>
      <div className="text-right text-sm text-stone-600">
        <p>Date: <strong>{today}</strong></p>
      </div>
    </div>
  );
}

function Recipient({ tenantName, contact, unitNumber }: { tenantName: string; contact: string | null | undefined; unitNumber: string }) {
  return (
    <div className="mt-4 text-sm leading-relaxed text-stone-700">
      <p className="font-semibold">{tenantName}</p>
      {contact && <p className="text-stone-500">{contact}</p>}
      <p className="text-stone-500">Unit {unitNumber}</p>
    </div>
  );
}

function PaymentNote() {
  return (
    <p className="mt-6 text-xs leading-relaxed text-stone-400">
      Please settle this balance at our office or via the designated payment channel. Late payments may be subject to penalty charges per your lease agreement. If you have already paid, kindly disregard this notice and present your official receipt.
    </p>
  );
}

function Signature() {
  return (
    <div className="mt-8 text-sm text-stone-700">
      <p>Sincerely,</p>
      <div className="mt-8 border-t border-stone-300 pt-2 w-48">
        <p className="font-semibold text-stone-800">Property Management</p>
        <p className="text-xs text-stone-500">{APP_BRAND_SHORT}</p>
      </div>
    </div>
  );
}

function StrategyCard({ icon, title, detail, recommended }: { icon: string; title: string; detail: string; recommended?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-sm ${recommended ? "border-sky-300 bg-white" : "border-sky-100 bg-sky-50/50"}`}>
      <p className="flex items-center gap-1.5 font-semibold text-sky-900">
        <span>{icon}</span> {title}
        {recommended && <span className="ml-auto rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Best</span>}
      </p>
      <p className="mt-1 text-xs text-sky-700 leading-relaxed">{detail}</p>
    </div>
  );
}
