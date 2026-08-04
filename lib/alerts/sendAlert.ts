import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * One alert abstraction with a driver switch (resend | n8n), defaulting to
 * resend so critical alerts don't depend on the n8n VPS. Flipping the driver is
 * a config change (ALERT_EMAIL_DRIVER) — no redeploy. Never throws: a failed
 * alert must not break the calling flow.
 */
export interface AlertInput {
  subject: string;
  body: string;
  to?: string; // comma-separated; defaults to ALERT_EMAIL_TO
}

export type AlertResult = { ok: boolean; skipped?: boolean; error?: string };

export async function sendAlert(input: AlertInput): Promise<AlertResult> {
  try {
    if (serverEnv.alertDriver === "n8n") return await sendViaN8n(input);
    if (serverEnv.alertDriver === "smtp") return await sendViaSmtp(input);
    return await sendViaResend(input);
  } catch (e) {
    console.error("sendAlert failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown error" };
  }
}

/** Gmail / SMTP transport — sends FROM the configured account (e.g. the Sun
 *  Miles Gmail). Requires a Gmail App Password (not the normal password). */
async function sendViaSmtp(input: AlertInput): Promise<AlertResult> {
  const to = input.to || serverEnv.alertEmailTo;
  if (!serverEnv.smtpUser || !serverEnv.smtpPass || !to) {
    console.warn("sendAlert(smtp): SMTP_USER / SMTP_PASS / ALERT_EMAIL_TO not set — skipping.");
    return { ok: false, skipped: true };
  }
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: serverEnv.smtpHost,
    port: serverEnv.smtpPort,
    secure: serverEnv.smtpPort === 465,
    auth: { user: serverEnv.smtpUser, pass: serverEnv.smtpPass },
  });
  await transport.sendMail({
    from: serverEnv.smtpFrom || serverEnv.smtpUser,
    to: to.split(",").map((s) => s.trim()).filter(Boolean),
    subject: input.subject,
    text: input.body,
  });
  return { ok: true };
}

async function sendViaResend(input: AlertInput): Promise<AlertResult> {
  const key = serverEnv.resendApiKey;
  const to = input.to || serverEnv.alertEmailTo;
  if (!key || !to) {
    console.warn("sendAlert(resend): RESEND_API_KEY or ALERT_EMAIL_TO not set — skipping.");
    return { ok: false, skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: serverEnv.resendFrom,
      to: to.split(",").map((s) => s.trim()).filter(Boolean),
      subject: input.subject,
      text: input.body,
    }),
  });
  if (!res.ok) {
    return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

async function sendViaN8n(input: AlertInput): Promise<AlertResult> {
  const url = serverEnv.n8nAlertWebhookUrl;
  if (!url) {
    console.warn("sendAlert(n8n): N8N_ALERT_WEBHOOK_URL not set — skipping.");
    return { ok: false, skipped: true };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, to: input.to || serverEnv.alertEmailTo }),
  });
  if (!res.ok) return { ok: false, error: `n8n ${res.status}` };
  return { ok: true };
}
