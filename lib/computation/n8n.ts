import "server-only";
import { serverEnv } from "@/lib/env";
import type { SOAInput, SOAResult } from "./types";

/**
 * n8n Computation Agent client. OPEN QUESTION: exact endpoint + request/response
 * schema — until confirmed, callers run the local driver. This posts the input
 * and, only if the response already matches our SOAResult shape, returns it;
 * otherwise returns null so computeSOA() falls back to local.
 * TODO(client-confirm): map the real n8n payload once the schema is provided.
 */
export async function computeViaN8n(input: SOAInput): Promise<SOAResult | null> {
  const url = serverEnv.n8nComputationWebhookUrl;
  if (!url) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<SOAResult>;
    if (data && Array.isArray(data.schedule) && data.totals) {
      return { ...(data as SOAResult), source: "n8n" };
    }
    return null;
  } catch {
    return null; // timeout / network / parse — graceful fallback to local
  } finally {
    clearTimeout(timer);
  }
}
