import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../supabase/migrations/0067_hotel_shift_handover.sql"), "utf8");

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();
await client.query(sql);
await client.end();
console.log("0067 applied");
