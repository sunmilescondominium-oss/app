import { todayBoard, type BoardStatus } from "@/lib/kiosk/queries";
import { APP_BRAND_SHORT, APP_BRAND } from "@/lib/config";
import { KioskClock } from "@/components/kiosk/kiosk-clock";

export const metadata = { title: "Attendance Kiosk" };
export const dynamic = "force-dynamic";

const STATUS: Record<BoardStatus, { label: string; badge: string; dot: string }> = {
  checked_in: { label: "In", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  checked_out: { label: "Out", badge: "bg-slate-200 text-slate-600", dot: "bg-slate-400" },
  on_ob: { label: "OB", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  on_leave: { label: "Leave", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  absent: { label: "Absent", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  off: { label: "Off", badge: "bg-slate-100 text-slate-400", dot: "bg-slate-300" },
};

function t(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

function initials(label: string): string {
  return label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function AttendanceKioskPage() {
  const { date, items } = await todayBoard();

  const order: BoardStatus[] = ["checked_in", "checked_out", "on_ob", "on_leave", "absent", "off"];
  const counts = order.map((s) => ({ s, n: items.filter((i) => i.status === s).length }));
  const dateLabel = new Date(`${date}T00:00:00+08:00`).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{APP_BRAND_SHORT}</h1>
        <p className="text-slate-600">Attendance Kiosk — {dateLabel}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <KioskClock />
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Your photo and device IP are recorded with each punch for verification.
          </p>
        </div>

        <div>
          {/* Status summary */}
          <div className="mb-4 flex flex-wrap gap-2">
            {counts.map(({ s, n }) => (
              <span key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[s].badge}`}>
                {STATUS[s].label}: {n}
              </span>
            ))}
          </div>

          {/* Board */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.length === 0 && <p className="text-sm text-slate-500">No staff to display yet.</p>}
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {i.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/kiosk/${i.id}/photo`} alt={i.label} className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                    {initials(i.label)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{i.label}</p>
                  <p className="text-xs text-slate-500">
                    {i.status === "checked_in" && `In ${t(i.timeIn)}`}
                    {i.status === "checked_out" && `In ${t(i.timeIn)} · Out ${t(i.timeOut)}`}
                    {i.status === "on_ob" && `Official Business${i.duration === "half_day" ? " (half day)" : ""}`}
                    {i.status === "on_leave" && `On leave${i.duration === "half_day" ? " (half day)" : ""}`}
                    {i.status === "absent" && "Scheduled — not yet in"}
                    {i.status === "off" && "Not scheduled"}
                  </p>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[i.status].badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS[i.status].dot}`} />
                  {STATUS[i.status].label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">{APP_BRAND}</p>
    </div>
  );
}
