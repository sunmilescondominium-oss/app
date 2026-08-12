import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Client } = require(join(__dirname, "../node_modules/pg/lib/index.js"));

const sql = readFileSync(join(__dirname, "../supabase/migrations/0063_notifications.sql"), "utf8");

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("✔ migration 0063 applied");
} finally {
  await client.end();
}
