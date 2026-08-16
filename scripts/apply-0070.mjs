import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sql = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/0070_collection_item_types.sql"),
  "utf8",
);

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log("✓ 0070_collection_item_types applied");
