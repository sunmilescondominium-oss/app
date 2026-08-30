/**
 * Demo staff accounts — one per staff role — so "Act as" / "Sign in as" always
 * lands on a populated screen while testing. Role-based labels only (no real
 * names). Idempotent. Each demo user gets:
 *   • the matching role
 *   • an employee ID + default kiosk PIN 0000
 *   • a daily pay rate + a few recent clock-in/out records (so DTR shows data)
 *
 *   npm run seed:roles
 *
 * Safe to re-run. Only touches accounts whose email ends with @demo.sunmiles.local
 * so it never affects real users. Remove them later with: npm run seed:roles -- --purge
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createHash } from "node:crypto";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { APP_DEMO_DOMAIN } from "../lib/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`✖ ${name} is not set in .env.local`); process.exit(1); }
  return v;
}

const DEMO_DOMAIN = APP_DEMO_DOMAIN;
const DEMO_PASSWORD = "demo1234"; // testing only
const hashPasscode = (empNo: string, pin: string) => createHash("sha256").update(`${empNo}:${pin}`).digest("hex");

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function at(date: string, hh: number, mm: number): string {
  return new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+08:00`).toISOString();
}

/** All demo activity is marked so it can be removed cleanly. */
type Sql = ReturnType<typeof postgres>;

async function clearDemoActivity(sql: Sql) {
  await sql`delete from public.collections where remarks like '[DEMO]%'`.catch(() => {});
  await sql`delete from public.expenses where remarks like '[DEMO]%'`.catch(() => {});
  await sql`delete from public.repair_requests where ticket_ref like 'DEMO-%'`.catch(() => {});
  await sql`delete from public.incidents where title like '[DEMO]%'`.catch(() => {});
  await sql`delete from public.rental_dues where remarks like '[DEMO]%'`.catch(() => {});
  await sql`delete from public.leases where tenant_label like '[DEMO]%'`.catch(() => {});
  await sql`delete from public.stays where guest_label like '[DEMO]%'`.catch(() => {});
}

async function seedActivity(sql: Sql) {
  await clearDemoActivity(sql); // idempotent — refresh, don't duplicate
  await sql`
    insert into public.collections (business_line, amount, payment_type, collected_by_role, collected_on, remarks)
    values ('hotel', 1500, 'cash', 'hotel_cashier', current_date, '[DEMO] sample room payment'),
           ('rental', 8000, 'cash', 'hotel_rental_monitoring', current_date, '[DEMO] sample rent')`.catch((e) => console.warn("  ⚠ collections:", e.message));
  await sql`
    insert into public.expenses (business_line, category, amount, expense_date, vendor, remarks)
    values ('hotel', 'Supplies', 350, current_date, 'Demo Supplier', '[DEMO] cleaning supplies')`.catch((e) => console.warn("  ⚠ expenses:", e.message));
  await sql`
    insert into public.repair_requests (ticket_ref, requester_type, issue_type, description, urgency, status)
    values ('DEMO-0001', 'tenant', 'Electrical', '[DEMO] Hallway light flickering on 2F', 'normal', 'submitted')`.catch((e) => console.warn("  ⚠ repairs:", e.message));
  await sql`
    insert into public.incidents (title, category, location, description, status, reported_by_role)
    values ('[DEMO] Perimeter light out', 'safety', 'Gate 2', 'Reported during evening patrol.', 'open', 'guard')`.catch((e) => console.warn("  ⚠ incidents:", e.message));

  // Hotel check-in on an available hotel room.
  const hotelUnit = await sql`
    select id from public.units where business_line = 'hotel' and is_active = true
      and id not in (select unit_id from public.stays where status = 'active' and unit_id is not null)
    order by unit_number limit 1`.catch(() => []);
  if (hotelUnit[0]) {
    await sql`
      insert into public.stays (unit_id, guest_label, planned_hours, base_hours, base_rate, extra_hour_rate, status)
      values (${hotelUnit[0].id as string}, '[DEMO] Walk-in guest', 3, 3, 250, 100, 'active')`.catch((e) => console.warn("  ⚠ stay:", e.message));
  }

  // Rental lease + dues (with a paid one for history) on an available rental unit.
  const rentUnit = await sql`
    select id from public.units where business_line = 'rental' and is_active = true
      and id not in (select unit_id from public.leases where status = 'active')
    order by unit_number limit 1`.catch(() => []);
  if (rentUnit[0]) {
    const uid = rentUnit[0].id as string;
    const lease = await sql`
      insert into public.leases (unit_id, business_line, tenant_label, contact, rent_amount, billing_cycle, status, notes)
      values (${uid}, 'rental', '[DEMO] Sample Tenant', '0917-000-0000', 8000, 'monthly', 'active', '[DEMO]')
      returning id`.catch((e) => { console.warn("  ⚠ lease:", e.message); return [] as { id: string }[]; });
    const leaseId = lease[0]?.id ?? null;
    await sql`
      insert into public.rental_dues (unit_id, lease_id, category, due_date, amount, status, remarks)
      values (${uid}, ${leaseId}, 'rent', current_date + 5, 8000, 'unpaid', '[DEMO] current month rent'),
             (${uid}, ${leaseId}, 'rent', current_date - 25, 8000, 'paid', '[DEMO] last month rent')`.catch((e) => console.warn("  ⚠ dues:", e.message));
    await sql`update public.rental_dues set paid_on = current_date - 22, ar_no = 'DEMO-AR-1'
      where unit_id = ${uid} and status = 'paid' and remarks like '[DEMO]%'`.catch(() => {});
  }
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = requireEnv("SUPABASE_DB_URL");
  const purge = process.argv.includes("--purge");

  const sql = postgres(dbUrl, { ssl: "require", onnotice: () => {} });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byEmail = new Map(list.data.users.map((u) => [u.email?.toLowerCase() ?? "", u.id]));

    if (purge) {
      await clearDemoActivity(sql);
      const demos = list.data.users.filter((u) => (u.email ?? "").endsWith(`@${DEMO_DOMAIN}`));
      for (const u of demos) { await admin.auth.admin.deleteUser(u.id); process.stdout.write(`✗ removed ${u.email}\n`); }
      console.log(`✔ purged ${demos.length} demo account(s) + demo activity.`);
      return;
    }

    // Active STAFF roles (is_staff) from the DB — new roles are covered automatically.
    const roles = await sql<{ role_key: string; label: string; sort_order: number }[]>`
      select role_key, label, sort_order from public.roles where is_staff = true and is_active = true order by sort_order`;

    let idx = 0;
    for (const r of roles) {
      idx += 1;
      const email = `demo_${r.role_key}@${DEMO_DOMAIN}`.toLowerCase();
      const label = `Demo — ${r.label}`;
      const employeeNo = `90${String(idx).padStart(2, "0")}`; // 9001, 9002, …

      let userId = byEmail.get(email);
      if (!userId) {
        const created = await admin.auth.admin.createUser({
          email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { display_label: label },
        });
        if (created.error && !/already/i.test(created.error.message)) throw created.error;
        userId = created.data?.user?.id ?? byEmail.get(email);
      }
      if (!userId) { console.warn(`⚠ could not resolve ${email}`); continue; }

      await sql`
        insert into public.profiles (id, display_label, employee_no, passcode_hash)
        values (${userId}, ${label}, ${employeeNo}, ${hashPasscode(employeeNo, "0000")})
        on conflict (id) do update set display_label = excluded.display_label, employee_no = excluded.employee_no, passcode_hash = excluded.passcode_hash`;
      await sql`insert into public.user_roles (user_id, role_key) values (${userId}, ${r.role_key}) on conflict do nothing`;

      // Daily rate (so payslip/DTR compute) — table exists from HR module.
      await sql`insert into public.staff_pay (user_id, daily_rate) values (${userId}, 610) on conflict (user_id) do update set daily_rate = excluded.daily_rate`.catch(() => {});

      // A few recent completed clock records so attendance/DTR isn't empty.
      for (const d of [1, 2, 3]) {
        const day = isoDaysAgo(d);
        await sql`
          insert into public.time_records (user_id, work_date, time_in, time_out)
          values (${userId}, ${day}, ${at(day, 8, 2)}, ${at(day, 17, 5)})
          on conflict do nothing`.catch(() => {});
      }

      process.stdout.write(`✔ ${label}  (${email} / ${DEMO_PASSWORD}, ID ${employeeNo}, PIN 0000)\n`);
    }

    await seedActivity(sql);
    console.log(`\n✔ Seeded ${roles.length} demo staff account(s) + a little sample activity per module.`);
    console.log(`  Accounts use password "${DEMO_PASSWORD}". Remove everything later with:  npm run seed:roles -- --purge`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
