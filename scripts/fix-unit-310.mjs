import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { error } = await supabase
  .from("units")
  .update({ is_active: true })
  .eq("id", "61509d5c-e809-44ba-9c5f-d16be2292f02");

if (error) { console.error("Failed:", error.message); process.exit(1); }
console.log("✓ Unit 310 (condo_sales, Sun Miles Condominium) reactivated");
