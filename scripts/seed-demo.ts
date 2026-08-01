/**
 * Seed DEMO data (supabase/seed/demo/*.sql). Separate from the default seed so
 * demo rows never land in production by accident.
 *
 *   npm run seed:demo
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl || dbUrl.includes("YOUR-PROJECT-ref")) {
    console.error("✖ SUPABASE_DB_URL is not set in .env.local");
    process.exit(1);
  }

  const dir = join(process.cwd(), "supabase", "seed", "demo");
  if (!existsSync(dir)) {
    console.log("No demo seed directory found.");
    return;
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const sql = postgres(dbUrl, { ssl: "require", onnotice: () => {} });
  try {
    for (const f of files) {
      process.stdout.write(`→ seeding demo ${f} ... `);
      await sql.unsafe(readFileSync(join(dir, f), "utf8"));
      console.log("done");
    }
    console.log(`✔ demo data seeded (${files.length} file(s))`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n✖ demo seed failed:\n", err);
  process.exit(1);
});
