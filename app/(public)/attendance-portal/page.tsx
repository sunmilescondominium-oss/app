import { cookies } from "next/headers";
import { todayBoard, type BoardStatus } from "@/lib/kiosk/queries";
import { getKioskSettings, kioskUnlocked, KIOSK_COOKIE } from "@/lib/kiosk/settings";
import { APP_BRAND_SHORT, APP_BRAND } from "@/lib/config";
import { KioskClock } from "@/components/kiosk/kiosk-clock";
import { KioskGate } from "@/components/kiosk/kiosk-gate";
import { DigitalClock } from "@/components/kiosk/digital-clock";

export const metadata = { title: "Attendance Kiosk" };
export const dynamic = "force-dynamic";

const STATUS: Record<BoardStatus, { label: string; badge: string; dot: string }> = {
  checked_in: { label: "In", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  checked_out: { label: "Out", badge: "bg-stone-200 text-stone-600", dot: "bg-stone-400" },
  on_ob: { label: "OB", badge: "bg-sky-100 text-sky-700", dot: "bg-sky-500" },
  on_leave: { label: "Leave", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  absent: { label: "Absent", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  off: { label: "Off", badge: "bg-stone-100 text-stone-400", dot: "bg-stone-300" },
};

function t(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

function initials(label: string): string {
  return label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

export default async function AttendanceKioskPage() {
  const settings = await getKioskSettings();
  const jar = await cookies();
  const unlocked = kioskUnlocked(settings.accessCode, jar.get(KIOSK_COOKIE)?.value);

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-2 text-center">
          <h1 className="text-2xl font-bold text-stone-900">{APP_BRAND_SHORT}</h1>
          <p className="text-stone-600">Attendance Kiosk</p>
        </header>
        <KioskGate />
      </div>
    );
  }

  const { date, items } = await todayBoard();

  const order: BoardStatus[] = ["checked_in", "checked_out", "on_ob", "on_leave", "absent", "off"];
  const counts = order.map((s) => ({ s, n: items.filter((i) => i.status === s).length }));

  // Expected today = scheduled staff who file a DTR and aren't on leave/OB.
  const expected = items.filter((i) => i.scheduled && !i.dtrExempt && i.status !== "on_leave" && i.status !== "on_ob");
  const present = expected.filter((i) => i.status === "checked_in" || i.status === "checked_out");
  const out = expected.filter((i) => i.status === "checked_out");
  const notYetIn = expected.filter((i) => i.status === "absent");
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
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
        <h1 className="text-2xl font-bold text-stone-900">{APP_BRAND_SHORT}</h1>
        <p className="mb-4 text-stone-600">Attendance Kiosk — {dateLabel}</p>
        <div className="mx-auto max-w-md">
          <DigitalClock />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div>
          <KioskClock
            cameraSeconds={settings.cameraSeconds}
            cameraRushSeconds={settings.cameraRushSeconds}
            rushWindows={settings.rushWindows}
          />
          <p className="mt-2 text-center text-[11px] text-stone-400">
            Your photo and device IP are recorded with each punch for verification.
          </p>
        </div>

        <div>
          {/* Today's progress vs the expected (scheduled) staff */}
          <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-4">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-stone-800">Clocked in</span>
              <span className="tabular-nums text-stone-500">{present.length} / {expected.length} expected · {notYetIn.length} not yet in</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct(present.length, expected.length)}%` }} />
            </div>
            <div className="mb-1 mt-4 flex items-baseline justify-between text-sm">
              <span className="font-semibold text-stone-800">Clocked out</span>
              <span className="tabular-nums text-stone-500">{out.length} / {present.length} present</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-stone-400 transition-all" style={{ width: `${pct(out.length, present.length)}%` }} />
            </div>
            <p className="mt-3 text-xs text-stone-400">
              “Expected” is who the shift schedule calls for today, minus staff on leave/OB and fixed-salary (no-DTR) staff.
            </p>
          </div>

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
            {items.length === 0 && <p className="text-sm text-stone-500">No staff to display yet.</p>}
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
                {settings.showPhotos && i.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/kiosk/${i.id}/photo`} alt={i.label} className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-stone-200" />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
                    {initials(i.label)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800">{i.label}</p>
                  <p className="text-xs text-stone-500">
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

      <p className="mt-8 text-center text-xs text-stone-400">{APP_BRAND}</p>
    </div>
  );
}
