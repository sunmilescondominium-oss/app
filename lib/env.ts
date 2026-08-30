import "server-only";
import { APP_BRAND_SHORT } from "@/lib/config";

/**
 * Server-only environment access. Importing this file from a client component
 * is a build error (thanks to `server-only`), which keeps secrets out of the
 * browser bundle. Values are read lazily so a missing key only throws when it
 * is actually used at runtime — not at build time with placeholder envs.
 */

/** Strip one layer of wrapping single/double quotes (Vercel stores them verbatim). */
function unquote(v: string): string {
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith("your-") || v.includes("YOUR-PROJECT-ref")) {
    throw new Error(
      `Missing/placeholder env var: ${name}. Set it in .env.local (see .env.example).`,
    );
  }
  return v;
}

export const serverEnv = {
  get supabaseUrl() {
    return req("NEXT_PUBLIC_SUPABASE_URL");
  },
  get anonKey() {
    return req("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get serviceRoleKey() {
    return req("SUPABASE_SERVICE_ROLE_KEY");
  },
  get n8nComputationWebhookUrl() {
    // May legitimately be empty until the client provides it (COMPUTATION_DRIVER=local).
    return process.env.N8N_COMPUTATION_WEBHOOK_URL ?? "";
  },
  get resendApiKey() {
    return process.env.RESEND_API_KEY ?? "";
  },
  /** smtp | resend (default) | n8n — flip the alert transport with no redeploy. */
  get alertDriver(): "resend" | "n8n" | "smtp" {
    const d = process.env.ALERT_EMAIL_DRIVER;
    if (d === "n8n") return "n8n";
    if (d === "smtp") return "smtp";
    return "resend";
  },
  /** Gmail / SMTP settings (used when ALERT_EMAIL_DRIVER=smtp). */
  get smtpHost() {
    return process.env.SMTP_HOST ?? "smtp.gmail.com";
  },
  get smtpPort() {
    return Number(process.env.SMTP_PORT ?? "465");
  },
  get smtpUser() {
    return unquote((process.env.SMTP_USER ?? "").trim());
  },
  get smtpPass() {
    // Gmail App Passwords are shown in groups of four; strip any spaces/newlines
    // (and stray wrapping quotes) so a pasted "abcd efgh ijkl mnop" still works.
    return unquote((process.env.SMTP_PASS ?? "").replace(/\s+/g, ""));
  },
  /** From-address for SMTP; defaults to the SMTP user (the Gmail account). */
  get smtpFrom() {
    return unquote((process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "").trim());
  },
  /** local (default) | n8n — SOA computation source; see lib/computation. */
  get computationDriver(): "local" | "n8n" {
    return process.env.COMPUTATION_DRIVER === "n8n" ? "n8n" : "local";
  },
  /** From-address for Resend. Resend's shared onboarding sender works for tests. */
  get resendFrom() {
    return process.env.RESEND_FROM ?? `${APP_BRAND_SHORT} <onboarding@resend.dev>`;
  },
  /** Comma-separated recipient(s) for operational alerts. */
  get alertEmailTo() {
    return process.env.ALERT_EMAIL_TO ?? "";
  },
  get n8nAlertWebhookUrl() {
    return process.env.N8N_ALERT_WEBHOOK_URL ?? "";
  },
  /** Shared secret the cron scheduler must present to hit /api/cron/*. */
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  /** VAPID private key for Web Push (kept server-side only). */
  get vapidPrivateKey() {
    return process.env.VAPID_PRIVATE_KEY ?? "";
  },
  /** VAPID subject (mailto: or https: URL identifying the push sender). */
  get vapidSubject() {
    return process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  },
};
