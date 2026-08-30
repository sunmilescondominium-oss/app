import { APP_STAFF_DOMAIN } from "@/lib/config";

// CSV headers + template for bulk-adding staff (creates login users + roles).
// Multiple roles in one cell are separated by "|" so the CSV stays comma-clean.

export const STAFF_HEADERS = ["email", "display_label", "roles", "daily_rate", "employee_no"] as const;

export const STAFF_TEMPLATE =
  STAFF_HEADERS.join(",") + "\n" +
  `cashier1@${APP_STAFF_DOMAIN},Front Desk Cashier,hotel_cashier,610,1001\n` +
  `maint1@${APP_STAFF_DOMAIN},Maintenance Staff,utility|electrician,560,1002\n` +
  "# roles: use role keys separated by | (e.g. hotel_cashier|room_attendant)\n" +
  "# existing emails are skipped · a temp password is set — use 'Send reset' so each person sets their own\n" +
  "# daily_rate & employee_no are optional (leave blank to skip)\n";
