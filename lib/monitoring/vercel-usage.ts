import "server-only";

export interface VercelUsage {
  invocations: number | null;
  invocationsLimit: number;
  bandwidthBytes: number | null;
  bandwidthLimitBytes: number;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  source: "api" | "static";
  error: string | null;
}

const HOBBY_INVOCATIONS  = 1_000_000;
const HOBBY_BANDWIDTH    = 100 * 1024 * 1024 * 1024; // 100 GB

export async function fetchVercelUsage(): Promise<VercelUsage> {
  const token  = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  const base: VercelUsage = {
    invocations: null,
    invocationsLimit: HOBBY_INVOCATIONS,
    bandwidthBytes: null,
    bandwidthLimitBytes: HOBBY_BANDWIDTH,
    billingPeriodStart: null,
    billingPeriodEnd: null,
    source: "static",
    error: null,
  };

  if (!token || !teamId) {
    base.error = "VERCEL_API_TOKEN or VERCEL_TEAM_ID not set";
    return base;
  }

  // Billing period: Vercel resets monthly from account creation day;
  // use start of current UTC month as safe approximation.
  const now   = new Date();
  const from  = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const to    = now.getTime();

  try {
    const res = await fetch(
      `https://api.vercel.com/v2/usage/billing?teamId=${teamId}&from=${from}&to=${to}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    if (!res.ok) {
      base.error = `Vercel API ${res.status}: ${res.statusText}`;
      return base;
    }

    const json = await res.json() as Record<string, unknown>;

    // The Vercel billing API returns a nested structure.
    // Field names vary slightly across API versions — try common shapes.
    const metrics = (json.metrics ?? json.usage ?? json) as Record<string, unknown>;

    const invocations =
      extractNumber(metrics, ["serverlessFunctionExecution", "invocations"]) ??
      extractNumber(json,    ["functionInvocations"]) ??
      extractNumber(json,    ["invocations"]);

    const bandwidth =
      extractNumber(metrics, ["bandwidth", "value"]) ??
      extractNumber(json,    ["bandwidthBytes"]) ??
      extractNumber(json,    ["bandwidth"]);

    const periodStart = extractString(json, ["from", "billingCycleStart", "periodStart"]);
    const periodEnd   = extractString(json, ["to",   "billingCycleEnd",   "periodEnd"]);

    return {
      ...base,
      invocations:       invocations ?? null,
      bandwidthBytes:    bandwidth   ?? null,
      billingPeriodStart: periodStart ?? new Date(from).toISOString(),
      billingPeriodEnd:   periodEnd   ?? now.toISOString(),
      source: "api",
      error: invocations == null ? "Response parsed but invocation field not found" : null,
    };
  } catch (err) {
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  }
}

function extractNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (obj[key] != null) {
      const v = obj[key];
      if (typeof v === "number") return v;
      if (typeof v === "object" && v !== null) {
        const inner = (v as Record<string, unknown>).value ?? (v as Record<string, unknown>).total;
        if (typeof inner === "number") return inner;
      }
    }
  }
  return null;
}

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (typeof obj[key] === "string") return obj[key] as string;
  }
  return null;
}
