import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { runHealthChecks, type Check, type CheckStatus } from "@/lib/monitoring/health";
import { listSystemErrors, type SystemError } from "@/lib/monitoring/error-log";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "System Health" };

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS: Record<CheckStatus, { icon: string; cls: string }> = {
  ok:      { icon: "✅", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  warn:    { icon: "⚠️", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  error:   { icon: "❌", cls: "bg-rose-50 text-rose-800 border-rose-200" },
  unknown: { icon: "❓", cls: "bg-stone-50 text-stone-600 border-stone-200" },
};

function StatusBadge({ status }: { status: CheckStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.icon} {status.toUpperCase()}
    </span>
  );
}

// ── Check row ─────────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: Check }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-800">{check.label}</p>
        <p className="mt-0.5 text-xs text-stone-500 leading-relaxed">{check.detail}</p>
      </div>
      <StatusBadge status={check.status} />
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function UsageBar({ used, limit, label }: { used: number | null; limit: number; label: string }) {
  const pct = used != null ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const tone = pct == null ? "stone" : pct > 80 ? "rose" : pct > 60 ? "amber" : "emerald";
  const pretty = (n: number) => {
    if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
    if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MB`;
    if (n >= 1_024)         return `${(n / 1_024).toFixed(1)} KB`;
    return `${n} B`;
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="text-stone-500">
          {used != null ? `${pretty(used)} / ${pretty(limit)}` : `— / ${pretty(limit)}`}
          {pct != null && <span className="ml-1 font-semibold">({pct}%)</span>}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
        {pct != null && (
          <div
            className={`h-2 rounded-full transition-all ${
              tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-400" : "bg-emerald-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {pct != null && pct > 80 && (
        <p className="mt-1 text-[11px] font-semibold text-rose-600">
          ⚠️ Approaching free tier limit — consider upgrading or archiving data
        </p>
      )}
    </div>
  );
}

// ── Diagnostics text builder ──────────────────────────────────────────────────

function buildDiagnosticsText(
  report: Awaited<ReturnType<typeof runHealthChecks>>,
  errors: SystemError[],
): string {
  const icon = (s: CheckStatus) => ({ ok: "✅", warn: "⚠️", error: "❌", unknown: "❓" }[s]);
  const pretty = (n: number) => {
    if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
    if (n >= 1_048_576)     return `${(n / 1_048_576).toFixed(1)} MB`;
    return `${Math.round(n / 1_024)} KB`;
  };

  const section = (title: string, checks: Check[]) =>
    `\n${title}\n${"─".repeat(title.length)}\n` +
    checks.map((c) => `${icon(c.status)} ${c.label}: ${c.detail}`).join("\n");

  const { storage } = report;
  const dbPct = storage.dbSizeBytes != null
    ? Math.round((storage.dbSizeBytes / storage.dbLimitBytes) * 100) + "%"
    : "unknown";

  const storageLines = [
    `DB size: ${storage.dbSizeBytes != null ? pretty(storage.dbSizeBytes) : "unknown"} / ${pretty(storage.dbLimitBytes)} free (${dbPct})`,
    `Push subscribers: ${storage.pushSubscriptionCount} device(s)`,
    `Active users: ${storage.userCount} / ${storage.userLimitMonthly.toLocaleString()} MAU free`,
  ].join("\n");

  const errLines = errors.length === 0
    ? "No errors logged."
    : errors.slice(0, 10).map((e) =>
        `[${new Date(e.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}] ${e.context}\n  ${e.message}${e.detail ? `\n  ${e.detail.split("\n")[0]}` : ""}`
      ).join("\n\n");

  return [
    "=== Sun Miles PMS — System Diagnostics ===",
    `Generated: ${report.generatedAt}`,
    `DB latency: ${report.latencyMs != null ? report.latencyMs + "ms" : "n/a"}`,
    section("CONNECTIVITY", report.connectivity),
    section("CONFIGURATION", report.config),
    section("MIGRATIONS", report.migrations),
    `\nFREE TIER USAGE\n${"─".repeat(16)}\n${storageLines}`,
    `\nRECENT ERRORS (last 10)\n${"─".repeat(23)}\n${errLines}`,
  ].join("\n");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "consultant"])) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  const [report, errors] = await Promise.all([
    runHealthChecks(),
    listSystemErrors(30),
  ]);

  const diagnosticsText = buildDiagnosticsText(report, errors);

  const overallStatus: CheckStatus = (
    [...report.connectivity, ...report.config, ...report.migrations].some((c) => c.status === "error")
      ? "error"
      : [...report.connectivity, ...report.config, ...report.migrations].some((c) => c.status === "warn")
      ? "warn"
      : "ok"
  );

  const latencyBadge =
    report.latencyMs == null ? null :
    report.latencyMs < 300 ? { text: `${report.latencyMs}ms`, cls: "text-emerald-700" } :
    report.latencyMs < 800 ? { text: `${report.latencyMs}ms — slow`, cls: "text-amber-700" } :
    { text: `${report.latencyMs}ms — very slow`, cls: "text-rose-700" };

  return (
    <>
      <PageHeader
        backHref="/admin"
        title="System Health"
        subtitle="Connectivity, configuration, free tier usage, and error log."
      />

      {/* Overall status bar */}
      <div className={`mb-6 flex items-center justify-between rounded-xl border p-4 ${
        overallStatus === "ok" ? "border-emerald-200 bg-emerald-50" :
        overallStatus === "warn" ? "border-amber-200 bg-amber-50" :
        "border-rose-200 bg-rose-50"
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {overallStatus === "ok" ? "✅" : overallStatus === "warn" ? "⚠️" : "❌"}
          </span>
          <div>
            <p className="font-semibold text-stone-800">
              {overallStatus === "ok" ? "All systems operational" :
               overallStatus === "warn" ? "Some items need attention" :
               "One or more systems have errors"}
            </p>
            <p className="text-xs text-stone-500">
              Checked at {new Date(report.generatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
              {latencyBadge && <span className={`ml-2 font-medium ${latencyBadge.cls}`}>· DB {latencyBadge.text}</span>}
            </p>
          </div>
        </div>
        <CopyButton text={diagnosticsText} label="Copy diagnostics" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Connectivity */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Connectivity</p>
          {report.connectivity.map((c) => <CheckRow key={c.label} check={c} />)}
        </div>

        {/* Configuration */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Configuration</p>
          {report.config.map((c) => <CheckRow key={c.label} check={c} />)}
        </div>

        {/* Migrations */}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">DB Migrations</p>
          {report.migrations.map((c) => <CheckRow key={c.label} check={c} />)}
          <p className="mt-3 text-[11px] text-stone-400">
            ❌ means migration SQL needs to be run in Supabase SQL editor.
          </p>
        </div>

        {/* Free tier */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 sm:col-span-2 lg:col-span-1">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Free Tier Usage</p>
          <div className="space-y-4">
            <UsageBar
              used={report.storage.dbSizeBytes}
              limit={report.storage.dbLimitBytes}
              label="Supabase DB (500 MB free)"
            />
            <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs text-stone-600">
              <div className="flex justify-between">
                <span>Push subscribers</span>
                <span className="font-semibold">{report.storage.pushSubscriptionCount} device(s)</span>
              </div>
              <div className="flex justify-between">
                <span>Active users</span>
                <span className="font-semibold">
                  {report.storage.userCount} / {report.storage.userLimitMonthly.toLocaleString()} MAU
                </span>
              </div>
            </div>
            <div className="border-t border-stone-100 pt-3 text-[11px] text-stone-400 space-y-0.5">
              <p>Vercel Hobby: 100 GB bandwidth/mo · daily cron only</p>
              <p>Supabase Free: 500 MB DB · 1 GB storage · 50k MAU</p>
              <p>VAPID push: free (no limit)</p>
            </div>
          </div>
        </div>

        {/* Error log */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 sm:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Error Log
              {errors.length > 0 && (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {errors.length}
                </span>
              )}
            </p>
            {errors.length > 0 && (
              <CopyButton
                text={errors.map((e) =>
                  `[${new Date(e.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}] ${e.context}\n${e.message}${e.detail ? "\n" + e.detail : ""}`
                ).join("\n\n---\n\n")}
                label="Copy errors"
              />
            )}
          </div>

          {errors.length === 0 ? (
            <p className="py-4 text-center text-sm text-stone-400">
              {report.migrations.some((c) => c.label === "System error log" && c.status === "error")
                ? "Run migration 0073 to enable the error log."
                : "No errors logged. System is running cleanly."}
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {errors.map((e) => (
                <div key={e.id} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono font-semibold text-rose-800">{e.context}</span>
                    <span className="shrink-0 text-stone-400">
                      {new Date(e.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                    </span>
                  </div>
                  <p className="mt-1 text-stone-700">{e.message}</p>
                  {e.detail && (
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[10px] text-stone-500 font-mono">
                      {e.detail.split("\n").slice(0, 5).join("\n")}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* What to watch */}
      <div className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">What to watch on free tiers</p>
        <div className="grid gap-x-6 gap-y-2 text-xs text-stone-600 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Supabase DB &gt; 400 MB", "Approach 500 MB free limit — archive old records or export data"],
            ["Supabase storage &gt; 800 MB", "Photos and documents count toward 1 GB free — delete old repair/doc photos"],
            ["Supabase MAU &gt; 40 000", "Monthly active users over 50 000 will suspend auth — unlikely but monitor if you scale"],
            ["Vercel bandwidth &gt; 80 GB", "100 GB/month Hobby limit — heavy image serving can push this"],
            ["DB latency &gt; 500ms", "Supabase may be throttling or your DB is under load — check Supabase dashboard"],
            ["GitHub push failing", "Check if GitHub token is still valid — re-auth with gh auth login if needed"],
          ].map(([title, desc]) => (
            <div key={title} className="flex gap-2">
              <span className="shrink-0 text-amber-500">⚠</span>
              <div>
                {/* eslint-disable-next-line react/no-danger */}
                <span className="font-medium" dangerouslySetInnerHTML={{ __html: title }} />
                <span className="text-stone-400"> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
