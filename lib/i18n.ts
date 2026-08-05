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

  // Leave / OB / request forms
  f_type: { en: "Type", fil: "Uri" },
  f_from: { en: "From", fil: "Mula" },
  f_to: { en: "To", fil: "Hanggang" },
  f_reason: { en: "Reason", fil: "Dahilan" },
  f_optional: { en: "Optional", fil: "Opsyonal" },
  f_request_leave: { en: "Request leave", fil: "Mag-request ng leave" },
  f_submitting: { en: "Submitting…", fil: "Isinusumite…" },
  f_lead_note: { en: "Please file ahead so coverage can be arranged.", fil: "Mangyaring mag-file nang maaga para may kapalit." },
  f_ob_date: { en: "OB date", fil: "Petsa ng OB" },
  f_until_opt: { en: "Until (optional)", fil: "Hanggang (opsyonal)" },
  f_duration: { en: "Duration", fil: "Tagal" },
  f_whole_day: { en: "Whole day", fil: "Buong araw" },
  f_half_day: { en: "Half day", fil: "Kalahating araw" },
  f_where: { en: "Where / purpose", fil: "Saan / layunin" },
  f_file_ob: { en: "File OB", fil: "Mag-file ng OB" },
  f_ob_note: { en: "Official Business needs approval. Auto-cancelled if you clock in that day.", fil: "Kailangan ng approval ang OB. Awtomatikong makakansela kung mag–time in ka sa araw na iyon." },
  f_request: { en: "Request", fil: "Request" },
  f_date: { en: "Date", fil: "Petsa" },
  f_hours: { en: "Hours", fil: "Oras" },
  f_subject: { en: "Subject", fil: "Paksa" },
  f_details: { en: "Details", fil: "Detalye" },
  f_submit_request: { en: "Submit request", fil: "Isumite ang request" },
  f_cancel: { en: "cancel", fil: "kanselahin" },
  f_cancel_confirm: { en: "Cancel this request?", fil: "Kanselahin ang request na ito?" },

  // Housekeeping
  hk_title: { en: "Housekeeping", fil: "Housekeeping" },
  hk_sub: { en: "Room cleaning, turnover & supplies", fil: "Paglilinis ng kwarto, turnover at supplies" },
  hk_to_clean: { en: "to clean", fil: "lilinisin" },
  hk_help_title: { en: "How housekeeping works", fil: "Paano ang housekeeping" },
  hk_help_1: { en: "A cleaning task appears automatically when a guest checks out.", fil: "Kusang lalabas ang cleaning task kapag nag-checkout ang guest." },
  hk_help_2: { en: "Open the room, tick the checklist, add photos, then mark it ready.", fil: "Buksan ang kwarto, i-tsek ang listahan, magdagdag ng litrato, tapos markahan ng ready." },
  hk_help_3: { en: "Issue supplies as you use them so stock stays correct.", fil: "I-record ang gamit na supplies para tama ang bilang." },
  hk_room: { en: "Room", fil: "Kwarto" },
  hk_shift: { en: "Shift", fil: "Shift" },
  hk_assigned: { en: "Assigned", fil: "Naka-assign" },
  hk_since: { en: "Since", fil: "Simula" },
  hk_no_tasks: { en: "No housekeeping tasks. They appear when a guest checks out.", fil: "Walang task. Lalabas ito kapag nag-checkout ang guest." },
  hk_st_pending: { en: "Pending", fil: "Naghihintay" },
  hk_st_in_progress: { en: "In progress", fil: "Ginagawa" },
  hk_st_done: { en: "Done", fil: "Tapos" },

  // Repairs
  rp_title: { en: "Repair Requests", fil: "Mga Repair Request" },
  rp_sub: { en: "Tenant & guest tickets — triage, assign, and track to completion", fil: "Mga ticket ng tenant/guest — i-triage, i-assign, at subaybayan hanggang matapos" },
  rp_open: { en: "open", fil: "bukas" },
};

/** Translate a key; falls back to English, then the key itself. */
export function t(lang: Lang, key: string): string {
  const e = DICT[key];
  if (!e) return key;
  return e[lang] ?? e.en ?? key;
}
