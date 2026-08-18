import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "warn" | "error" | "unknown";

export interface Check {
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface StorageInfo {
  dbSizeBytes: number | null;
  dbLimitBytes: number;        // Supabase free: 500 MB
  storageLimitBytes: number;   // Supabase free: 1 GB
  pushSubscriptionCount: number;
  userCount: number;
  userLimitMonthly: number;    // Supabase free: 50 000 MAU
}

export interface HealthReport {
  generatedAt: string;
  latencyMs: number | null;    // DB round-trip
  connectivity: Check[];
  config: Check[];
  migrations: Check[];
  storage: StorageInfo;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function envSet(name: string): boolean {
  const v = process.env[name];
  return !!v && !v.startsWith("your-") && !v.includes("YOUR-PROJECT");
}

function c(label: string, status: CheckStatus, detail: string): Check {
  return { label, status, detail };
}

// ── Health checks ─────────────────────────────────────────────────────────────

async function checkConnectivity(admin: ReturnType<typeof createAdminClient>): Promise<{
  checks: Check[];
  latencyMs: number | null;
}> {
  const checks: Check[] = [];
  let latencyMs: number | null = null;

  // Supabase DB ping
  try {
    const t0 = Date.now();
    const { error } = await admin.from("profiles").select("id").limit(1);
    latencyMs = Date.now() - t0;
    if (error) {
      checks.push(c("Supabase DB", "error", `Query failed: ${error.message}`));
    } else {
      const quality = latencyMs < 300 ? "ok" : latencyMs < 800 ? "warn" : "error";
      checks.push(c("Supabase DB", quality, `Responding — ${latencyMs}ms round-trip${latencyMs > 300 ? " (slow)" : ""}`));
    }
  } catch (err) {
    checks.push(c("Supabase DB", "error", `Cannot connect: ${String(err)}`));
  }

  // Supabase URL reachable
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl) {
    checks.push(c("Supabase URL", "error", "NEXT_PUBLIC_SUPABASE_URL is not set"));
  } else {
    checks.push(c("Supabase URL", "ok", supabaseUrl.replace(/https?:\/\//, "").split(".")[0] + ".supabase.co"));
  }

  // Vercel: we're running, so it's fine — just confirm env
  const isVercel = !!process.env.VERCEL;
  const region = process.env.VERCEL_REGION ?? process.env.VERCEL_EDGE_CONFIG ?? "unknown";
  checks.push(c(
    "Vercel deployment",
    isVercel ? "ok" : "warn",
    isVercel ? `Running on Vercel (${region})` : "Running locally (not on Vercel)"
  ));

  // GitHub: we can't ping it without a token — just note it
  checks.push(c(
    "GitHub repo",
    "unknown",
    "sunmilescondominium-oss/app — check github.com manually if push fails"
  ));

  return { checks, latencyMs };
}

function checkConfig(): Check[] {
  const checks: Check[] = [];

  // Core (required)
  const coreOk = envSet("NEXT_PUBLIC_SUPABASE_URL") && envSet("NEXT_PUBLIC_SUPABASE_ANON_KEY") && envSet("SUPABASE_SERVICE_ROLE_KEY");
  checks.push(c("Supabase core keys", coreOk ? "ok" : "error",
    coreOk ? "URL + Anon key + Service role key — all set" : "One or more Supabase keys are missing"
  ));

  // Cron secret
  checks.push(c("CRON_SECRET", envSet("CRON_SECRET") ? "ok" : "warn",
    envSet("CRON_SECRET") ? "Set — cron routes are protected" : "Not set — cron routes are unprotected (anyone can call them)"
  ));

  // VAPID / push
  const vapidOk = envSet("NEXT_PUBLIC_VAPID_PUBLIC_KEY") && envSet("VAPID_PRIVATE_KEY") && envSet("VAPID_SUBJECT");
  const vapidPartial = !vapidOk && (envSet("NEXT_PUBLIC_VAPID_PUBLIC_KEY") || envSet("VAPID_PRIVATE_KEY"));
  checks.push(c("VAPID push keys",
    vapidOk ? "ok" : vapidPartial ? "error" : "warn",
    vapidOk
      ? "Public key + Private key + Subject — all set"
      : vapidPartial
      ? "Partially configured — push will fail until all 3 vars are set"
      : "Not configured — push notifications are disabled (subscribe button hidden)"
  ));

  // Email
  const hasResend = envSet("RESEND_API_KEY");
  const hasSmtp = envSet("SMTP_HOST") && envSet("SMTP_USER") && envSet("SMTP_PASS");
  const emailOk = hasResend || hasSmtp;
  checks.push(c("Email / alerts",
    emailOk ? "ok" : "warn",
    emailOk
      ? (hasResend ? "Resend API key set" : "SMTP configured")
      : "No email transport configured — alert emails will be skipped"
  ));

  // Alert recipient
  checks.push(c("ALERT_EMAIL_TO", envSet("ALERT_EMAIL_TO") ? "ok" : "warn",
    envSet("ALERT_EMAIL_TO") ? "Alert recipient address set" : "Not set — operational alerts have no recipient"
  ));

  return checks;
}

async function checkMigrations(admin: ReturnType<typeof createAdminClient>): Promise<Check[]> {
  const tables = [
    { table: "push_subscriptions",      migration: "0072", label: "Push subscriptions" },
    { table: "push_notifications_log",  migration: "0072", label: "Push notifications log" },
    { table: "app_settings",            migration: "0071", label: "App settings (timezone)" },
    { table: "system_errors",           migration: "0073", label: "System error log" },
  ];

  const checks: Check[] = [];
  for (const { table, migration, label } of tables) {
    const { error } = await admin.from(table as "profiles").select("id").limit(1);
    const missing = error?.code === "42P01" || error?.message?.includes("does not exist");
    checks.push(c(label,
      missing ? "error" : "ok",
      missing
        ? `Table "${table}" not found — run migration ${migration} in Supabase SQL editor`
        : `Table exists (migration ${migration} applied)`
    ));
  }
  return checks;
}

async function checkStorage(admin: ReturnType<typeof createAdminClient>): Promise<StorageInfo> {
  const DB_FREE_LIMIT  = 500 * 1024 * 1024;   // 500 MB
  const STG_FREE_LIMIT = 1024 * 1024 * 1024;  // 1 GB
  const MAU_FREE_LIMIT = 50_000;

  // DB size
  let dbSizeBytes: number | null = null;
  try {
    const { data } = await admin.rpc("get_db_size_bytes");
    if (typeof data === "number") dbSizeBytes = data;
  } catch { /* function may not exist yet */ }

  // Push subscription count
  let pushSubscriptionCount = 0;
  try {
    const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true });
    pushSubscriptionCount = count ?? 0;
  } catch { /* table may not exist */ }

  // Active user count (profiles with is_active = true)
  let userCount = 0;
  try {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true);
    userCount = count ?? 0;
  } catch { /* ignore */ }

  return {
    dbSizeBytes,
    dbLimitBytes: DB_FREE_LIMIT,
    storageLimitBytes: STG_FREE_LIMIT,
    pushSubscriptionCount,
    userCount,
    userLimitMonthly: MAU_FREE_LIMIT,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runHealthChecks(): Promise<HealthReport> {
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  const [{ checks: connectivity, latencyMs }, config, migrations, storage] = await Promise.all([
    checkConnectivity(admin),
    Promise.resolve(checkConfig()),
    checkMigrations(admin),
    checkStorage(admin),
  ]);

  return { generatedAt, latencyMs, connectivity, config, migrations, storage };
}
