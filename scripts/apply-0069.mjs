import { readFileSync } from "fs";
import pg from "pg";

const sql = readFileSync(
  new URL("../supabase/migrations/0069_bank_deposit_config_and_role_groups.sql", import.meta.url),
  "utf8",
);

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();
try {
  await client.query(sql);
  console.log("✓ 0069_bank_deposit_config_and_role_groups applied");
} finally {
  await client.end();
}
