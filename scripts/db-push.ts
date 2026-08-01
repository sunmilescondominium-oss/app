/**
 * Apply all SQL migrations in supabase/migrations (sorted by filename) to the
 * database identified by SUPABASE_DB_URL. No Supabase CLI required.
 *
 *   npm run db:push
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl || dbUrl.includes("YOUR-PROJECT-ref")) {
    console.error("✖ SUPABASE_DB_URL is not set in .env.local");
    process.exit(1);
  }

  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  // Supabase requires SSL; 'require' encrypts without CA verification (fine for
  // connecting to your own project's DB).
  const sql = postgres(dbUrl, { ssl: "require", onnotice: () => {} });
  try {
    for (const f of files) {
      const contents = readFileSync(join(dir, f), "utf8");
      process.stdout.write(`→ applying ${f} ... `);
      await sql.unsafe(contents);
      console.log("done");
    }
    console.log(`✔ applied ${files.length} migration(s)`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n✖ migration failed:\n", err);
  process.exit(1);
});
