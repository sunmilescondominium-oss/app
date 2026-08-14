import { readFileSync } from "fs";
import pg from "pg";

const sql = readFileSync(
  new URL("../supabase/migrations/0068_unit_billing_and_bank.sql", import.meta.url),
  "utf8",
);

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log("✓ 0068_unit_billing_and_bank applied");
} finally {
  await client.end();
}
