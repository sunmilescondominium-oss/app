export type PeriodPreset = "today" | "week" | "month" | "quarter" | "year" | "custom";
export type CompareMode = "none" | "prev_period" | "prev_year";

function manilaNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function presetDates(preset: PeriodPreset): [string, string] {
  const now = manilaNow();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dow = now.getDay();

  switch (preset) {
    case "today": {
      const t = iso(now);
      return [t, t];
    }
    case "week": {
      const mondayOff = dow === 0 ? -6 : 1 - dow;
      return [iso(new Date(y, m, d + mondayOff)), iso(new Date(y, m, d + mondayOff + 6))];
    }
    case "month":
      return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
    case "quarter": {
      const q = Math.floor(m / 3);
      return [iso(new Date(y, q * 3, 1)), iso(new Date(y, (q + 1) * 3, 0))];
    }
    case "year":
      return [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))];
    default:
      return [iso(now), iso(now)];
  }
}

export function priorDates(from: string, to: string, mode: CompareMode): [string, string] | null {
  if (mode === "none") return null;

  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");

  if (mode === "prev_year") {
    const pf = new Date(f);
    const pt = new Date(t);
    pf.setFullYear(pf.getFullYear() - 1);
    pt.setFullYear(pt.getFullYear() - 1);
    return [iso(pf), iso(pt)];
  }

  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const ms = days * 86400000;
  return [iso(new Date(f.getTime() - ms)), iso(new Date(t.getTime() - ms))];
}

export function formatPeriodLabel(from: string, to: string): string {
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  quarter: "This Quarter",
  year: "This Year",
  custom: "Custom",
};
