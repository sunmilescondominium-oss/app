/**
 * Philippine daily-rate payroll engine (pure functions — no DB, no I/O).
 *
 * One clocked day (time_in/time_out) + the org schedule → a fully itemized
 * day computation following the Labor Code:
 *   hourly            = daily_rate / standard_hours
 *   late / undertime  = minutes outside the scheduled window (grace applied to
 *                       late only); deducted proportionally from the daily rate
 *   overtime          = minutes past scheduled-out × hourly × ot_multiplier
 *   night diff        = minutes worked in [night_start, night_end] × hourly × rate
 *   undertime is NOT offset by overtime (Art. 88) — surfaced as separate lines.
 *
 * Manila is UTC+08:00 year-round (no DST), so scheduled instants are built with
 * a fixed +08:00 offset.
 */

export interface PayrollSettings {
  scheduled_time_in: string; // 'HH:MM' or 'HH:MM:SS'
  standard_hours: number;
  break_hours: number;
  grace_minutes: number;
  ot_multiplier: number;
  night_diff_rate: number;
  night_start: string;
  night_end: string;
  half_day_hours: number;
}

export interface DayInput {
  work_date: string; // 'YYYY-MM-DD'
  time_in: string | null;
  time_out: string | null;
}

export type DayStatus = "present" | "half_day" | "absent" | "open";

export interface DayComputation {
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  workedHours: number; // gross clocked span (hours), for reference
  lateMinutes: number;
  undertimeMinutes: number;
  regularHours: number; // payable regular hours (≤ standard)
  otHours: number;
  nightHours: number;
  status: DayStatus;
  basicPay: number;
  otPay: number;
  nightPay: number;
  lateDeduction: number;
  undertimeDeduction: number;
  netPay: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Build a Manila instant (UTC+8) from a date and 'HH:MM[:SS]' clock time. */
function manilaInstant(date: string, clock: string, addDays = 0): number {
  const [h = 0, m = 0, s = 0] = clock.split(":").map(Number);
  const base = new Date(`${date}T00:00:00+08:00`).getTime();
  return base + addDays * 86_400_000 + ((h * 60 + m) * 60 + s) * 1000;
}

/** Minutes of [aStart,aEnd] that fall within [bStart,bEnd]. */
function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const lo = Math.max(aStart, bStart);
  const hi = Math.min(aEnd, bEnd);
  return hi > lo ? (hi - lo) / 60_000 : 0;
}

/** The night-diff window anchored on `date + dayOffset` (wraps past midnight). */
function nightWindow(date: string, s: PayrollSettings, dayOffset: number): [number, number] {
  const start = manilaInstant(date, s.night_start, dayOffset);
  const endSameDay = manilaInstant(date, s.night_end, dayOffset);
  const end = endSameDay <= start ? manilaInstant(date, s.night_end, dayOffset + 1) : endSameDay;
  return [start, end];
}

export function computeDay(rec: DayInput, s: PayrollSettings, dailyRate: number): DayComputation {
  const stdMins = s.standard_hours * 60;
  const hourly = s.standard_hours > 0 ? dailyRate / s.standard_hours : 0;

  const base: DayComputation = {
    date: rec.work_date,
    timeIn: rec.time_in,
    timeOut: rec.time_out,
    workedHours: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    regularHours: 0,
    otHours: 0,
    nightHours: 0,
    status: "open",
    basicPay: 0,
    otPay: 0,
    nightPay: 0,
    lateDeduction: 0,
    undertimeDeduction: 0,
    netPay: 0,
  };

  // An unpaired record (still clocked in) can't be paid yet.
  if (!rec.time_in || !rec.time_out) return base;

  const actualIn = new Date(rec.time_in).getTime();
  const actualOut = new Date(rec.time_out).getTime();
  if (!(actualOut > actualIn)) return { ...base, status: "absent" };

  const schedIn = manilaInstant(rec.work_date, s.scheduled_time_in);
  // Scheduled span covers standard hours + the unpaid break.
  const schedOut = schedIn + (s.standard_hours + s.break_hours) * 3_600_000;

  const lateMinutes = Math.max(0, (actualIn - (schedIn + s.grace_minutes * 60_000)) / 60_000);
  const undertimeMinutes = Math.max(0, (schedOut - actualOut) / 60_000);

  const renderedRegularMins = clamp(stdMins - lateMinutes - undertimeMinutes, 0, stdMins);
  const otMins = Math.max(0, (actualOut - schedOut) / 60_000);

  // Night differential — sum overlap with the night window of the prior, same,
  // and next day (the windows are disjoint, so no double counting).
  let nightMins = 0;
  for (const k of [-1, 0, 1]) {
    const [ns, ne] = nightWindow(rec.work_date, s, k);
    nightMins += overlapMinutes(actualIn, actualOut, ns, ne);
  }

  const regularHours = renderedRegularMins / 60;
  const otHours = otMins / 60;
  const nightHours = nightMins / 60;

  const lateDeduction = r2(hourly * (lateMinutes / 60));
  const undertimeDeduction = r2(hourly * (undertimeMinutes / 60));
  const basicPay = r2(dailyRate * (renderedRegularMins / stdMins));
  const otPay = r2(hourly * s.ot_multiplier * otHours);
  const nightPay = r2(hourly * s.night_diff_rate * nightHours);

  const status: DayStatus =
    renderedRegularMins <= 0 && otMins <= 0
      ? "absent"
      : renderedRegularMins <= s.half_day_hours * 60
        ? "half_day"
        : "present";

  return {
    ...base,
    workedHours: r2((actualOut - actualIn) / 3_600_000),
    lateMinutes: Math.round(lateMinutes),
    undertimeMinutes: Math.round(undertimeMinutes),
    regularHours: r2(regularHours),
    otHours: r2(otHours),
    nightHours: r2(nightHours),
    status,
    basicPay,
    otPay,
    nightPay,
    lateDeduction,
    undertimeDeduction,
    netPay: r2(basicPay + otPay + nightPay),
  };
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  scheduled_time_in: "09:00",
  standard_hours: 8,
  break_hours: 1,
  grace_minutes: 0,
  ot_multiplier: 1.25,
  night_diff_rate: 0.1,
  night_start: "22:00",
  night_end: "06:00",
  half_day_hours: 4,
};
