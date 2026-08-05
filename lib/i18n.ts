// Lightweight bilingual (English / Filipino) dictionary. Client-safe: any
// component can call t(lang, key). Add keys as more screens are translated.

export type Lang = "en" | "fil";
export const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "fil", label: "Filipino" },
];

type Entry = { en: string; fil: string };

export const DICT: Record<string, Entry> = {
  // Attendance kiosk
  kiosk_title: { en: "Attendance Kiosk", fil: "Attendance Kiosk" },
  clock_in: { en: "Clock In", fil: "Time In" },
  clock_out: { en: "Clock Out", fil: "Time Out" },
  turn_on_camera: { en: "Turn on camera", fil: "Buksan ang camera" },
  camera_on: { en: "Camera on", fil: "Naka-on ang camera" },
  turn_off: { en: "Turn off", fil: "I-off" },
  extend: { en: "Extend", fil: "Palawigin" },
  scan_qr: { en: "Scan QR badge", fil: "I-scan ang QR badge" },
  cancel_scan: { en: "Cancel scan", fil: "Ikansela ang scan" },
  id_number: { en: "ID number", fil: "ID number" },
  passcode: { en: "Passcode", fil: "Passcode" },
  or_enter_manually: { en: "or enter manually", fil: "o mano-manong ilagay" },
  please_wait: { en: "Please wait…", fil: "Sandali lang po…" },
  photo_auto: { en: "Your photo is captured automatically.", fil: "Kusang kukuha ng litrato." },
  turn_on_to_clock: { en: "Turn on the camera to clock in or out.", fil: "Buksan ang camera para mag–time in o out." },
  // Kiosk steps (guide)
  step_1: { en: "1. Turn on the camera", fil: "1. Buksan ang camera" },
  step_2: { en: "2. Enter your ID + passcode, or scan your QR", fil: "2. Ilagay ang ID + passcode, o i-scan ang QR" },
  step_3: { en: "3. Tap Time In or Time Out", fil: "3. Pindutin ang Time In o Time Out" },
  how_to: { en: "How to clock in / out", fil: "Paano mag-time in / out" },
  // Board statuses
  st_in: { en: "In", fil: "Pasok" },
  st_out: { en: "Out", fil: "Labas" },
  st_ob: { en: "OB", fil: "OB" },
  st_leave: { en: "Leave", fil: "Leave" },
  st_absent: { en: "Absent", fil: "Absent" },
  st_off: { en: "Off", fil: "Off" },
  clocked_in: { en: "Clocked in", fil: "Naka-time in" },
  clocked_out: { en: "Clocked out", fil: "Naka-time out" },
  expected: { en: "expected", fil: "inaasahan" },
  not_yet_in: { en: "not yet in", fil: "hindi pa pasok" },
  present: { en: "present", fil: "naroroon" },
  // Common
  language: { en: "Language", fil: "Wika" },

  // My Portal (/me)
  my_portal: { en: "My Portal", fil: "Aking Portal" },
  my_portal_sub: { en: "Your attendance, leave, and staff details.", fil: "Ang iyong attendance, leave, at mga detalye." },
  account_signin: { en: "Account & sign-in", fil: "Account at sign-in" },
  pay_this_month: { en: "My pay this month (est.)", fil: "Sahod ngayong buwan (tantiya)" },
  view_payslip: { en: "View / print payslip →", fil: "Tingnan / i-print ang payslip →" },
  my_attendance: { en: "My attendance", fil: "Aking attendance" },
  clock_at_kiosk: { en: "Clock in / out at the attendance kiosk", fil: "Mag–time in/out sa attendance kiosk" },
  this_month: { en: "This month", fil: "Ngayong buwan" },
  col_date: { en: "Date", fil: "Petsa" },
  col_hrs: { en: "Hrs", fil: "Oras" },
  no_records: { en: "No records yet.", fil: "Wala pang record." },
  open_rec: { en: "open", fil: "bukas" },
  requests: { en: "Requests", fil: "Mga Request" },
  col_type: { en: "Type", fil: "Uri" },
  col_dates: { en: "Dates", fil: "Mga Petsa" },
  col_status: { en: "Status", fil: "Status" },
  no_leave: { en: "No leave requests yet.", fil: "Wala pang leave request." },
};

/** Translate a key; falls back to English, then the key itself. */
export function t(lang: Lang, key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return e[lang] ?? e.en ?? key;
}
