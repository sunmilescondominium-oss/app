import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Find all units with unit_number containing "310"
const { data: units, error } = await supabase
  .from("units")
  .select("id, unit_number, business_line, status, is_active, property_id, properties(name)")
  .ilike("unit_number", "%310%");

if (error) { console.error("Error:", error.message); process.exit(1); }

console.log("Units matching '310':");
console.table(units?.map(u => ({
  id: u.id,
  unit_number: u.unit_number,
  business_line: u.business_line,
  status: u.status,
  is_active: u.is_active,
  property: u.properties?.name ?? "(no property)",
})));

// Also check condo_sales specifically
const { data: condoUnits } = await supabase
  .from("units")
  .select("id, unit_number, business_line, status, is_active, properties(name)")
  .eq("business_line", "condo_sales");

console.log("\nAll condo_sales units:");
console.table(condoUnits?.map(u => ({
  id: u.id,
  unit_number: u.unit_number,
  status: u.status,
  is_active: u.is_active,
  property: u.properties?.name ?? "(no property)",
})));
