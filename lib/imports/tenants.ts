export const TENANTS_HEADERS = [
  "unit_number", "tenant_label", "contact", "rent_amount",
  "billing_cycle", "deposit", "portal_pin", "start_date",
] as const;

/** Template CSV for bulk-loading current tenants (rental/airbnb leases). */
export const TENANTS_TEMPLATE =
  TENANTS_HEADERS.join(",") + "\n" +
  "R-201,Tenant A,0917-000-0000,8000,monthly,8000,1234,2026-01-01\n" +
  "AIRBNB-1,Tenant B,0917-111-1111,2500,nightly,0,5678,2026-02-10\n" +
  "# unit must be a rental/airbnb unit that is currently vacant · billing_cycle: monthly|nightly · dates: YYYY-MM-DD\n";
