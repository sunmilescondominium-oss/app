/**
 * Quick diagnostic: runs the exact same queries as listHousekeepingTasks
 * to see what Supabase returns from the admin client.
 * Run: node scripts/test-hk-query.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDemoMode = false;

console.log("=== Step 1: units where is_demo =", isDemoMode, "===");
const { data: unitRows, error: unitErr } = await admin
  .from("units")
  .select("id, unit_number, is_demo")
  .eq("is_demo", isDemoMode);

if (unitErr) console.error("units error:", unitErr);
else console.log(`Found ${unitRows?.length ?? 0} non-demo units (showing first 5):`);
console.log(unitRows?.slice(0, 5).map((u) => `  ${u.id} ${u.unit_number} is_demo=${u.is_demo}`).join("\n"));

const validUnitIds = new Set((unitRows ?? []).map((u) => u.id));

console.log("\n=== Step 2: housekeeping_tasks (pending + in_progress only — new query) ===");
const { data: tasks, error: taskErr } = await admin
  .from("housekeeping_tasks")
  .select("id, status, unit_id, units(unit_number)")
  .in("status", ["pending", "in_progress"])
  .order("created_at", { ascending: false });

if (taskErr) console.error("tasks error:", taskErr);
else console.log(`Total tasks returned: ${tasks?.length ?? 0}`);

const pending = tasks ?? [];
console.log(`Open tasks: ${pending.length}`);
pending.forEach((t) => {
  const u = t.units;
  console.log(`  id=${t.id.slice(0, 8)} status=${t.status} unit_id=${t.unit_id?.slice(0, 8)} unit_number=${u?.unit_number ?? "NULL"} in_valid_set=${validUnitIds.has(t.unit_id)}`);
});

console.log("\n=== Step 3: after is_demo filter ===");
const filtered = pending.filter((r) => {
  if (!r.unit_id) return !isDemoMode;
  return validUnitIds.has(r.unit_id);
});
console.log(`Tasks after filter: ${filtered.length}`);
filtered.forEach((t) => {
  const u = t.units;
  console.log(`  VISIBLE: ${u?.unit_number ?? "no-unit"} status=${t.status}`);
});
