/**
 * Seed reference data + the bootstrap owner/admin account.
 *
 *   1. Runs every SQL file in supabase/seed (roles, and later doc types / cases).
 *   2. Creates the bootstrap auth user from BOOTSTRAP_OWNER_* env (idempotent).
 *   3. Ensures that user has the `owner` and `admin` roles.
 *
 * Credentials come from env — never hardcoded. Run AFTER `npm run db:push`.
 *
 *   npm run seed
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith("your-") || v.includes("YOUR-PROJECT-ref")) {
    console.error(`✖ ${name} is not set in .env.local`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = requireEnv("SUPABASE_DB_URL");
  const email = requireEnv("BOOTSTRAP_OWNER_EMAIL");
  const password = requireEnv("BOOTSTRAP_OWNER_PASSWORD");
  const displayLabel = process.env.BOOTSTRAP_OWNER_DISPLAY_LABEL || "Owner";

  // Supabase requires SSL; 'require' encrypts without CA verification.
  const sql = postgres(dbUrl, { ssl: "require", onnotice: () => {} });

  try {
    // 1. Reference-data seed files.
    const seedDir = join(process.cwd(), "supabase", "seed");
    const files = readdirSync(seedDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      process.stdout.write(`→ seeding ${f} ... `);
      await sql.unsafe(readFileSync(join(seedDir, f), "utf8"));
      console.log("done");
    }

    // 2. Bootstrap owner auth user (idempotent).
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | undefined;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_label: displayLabel },
    });
    if (created.error && !/already been registered|already exists/i.test(created.error.message)) {
      throw created.error;
    }
    userId = created.data?.user?.id;

    if (!userId) {
      // Already existed — look it up.
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = list.data.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      )?.id;
    }
    if (!userId) throw new Error("could not resolve bootstrap owner user id");

    // 3. Ensure profile + owner/admin roles.
    await sql`
      insert into public.profiles (id, display_label)
      values (${userId}, ${displayLabel})
      on conflict (id) do update set display_label = excluded.display_label`;
    await sql`
      insert into public.user_roles (user_id, role_key)
      values (${userId}, 'owner'), (${userId}, 'admin')
      on conflict do nothing`;

    console.log(`✔ bootstrap owner ready: ${email}  (roles: owner, admin)`);

    // 4. Ensure the PRIVATE storage bucket for buyer document scans exists.
    const bucket = await admin.storage.createBucket("buyer-documents", { public: false });
    if (bucket.error && !/exist/i.test(bucket.error.message)) {
      console.warn("⚠ bucket buyer-documents:", bucket.error.message);
    } else {
      console.log("✔ storage bucket buyer-documents ready (private)");
    }

    const repairBucket = await admin.storage.createBucket("repair-photos", { public: false });
    if (repairBucket.error && !/exist/i.test(repairBucket.error.message)) {
      console.warn("⚠ bucket repair-photos:", repairBucket.error.message);
    } else {
      console.log("✔ storage bucket repair-photos ready (private)");
    }

    const attBucket = await admin.storage.createBucket("attendance-photos", { public: false });
    if (attBucket.error && !/exist/i.test(attBucket.error.message)) {
      console.warn("⚠ bucket attendance-photos:", attBucket.error.message);
    } else {
      console.log("✔ storage bucket attendance-photos ready (private)");
    }

    const staffBucket = await admin.storage.createBucket("staff-photos", { public: false });
    if (staffBucket.error && !/exist/i.test(staffBucket.error.message)) {
      console.warn("⚠ bucket staff-photos:", staffBucket.error.message);
    } else {
      console.log("✔ storage bucket staff-photos ready (private)");
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n✖ seed failed:\n", err);
  process.exit(1);
});
