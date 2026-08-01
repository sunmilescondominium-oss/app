import "server-only";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { computeLocal } from "./local";
import { computeViaN8n } from "./n8n";
import type { ParamMap, SOAInput, SOAResult } from "./types";

export type { SOAInput, SOAResult } from "./types";

export async function loadParams(): Promise<ParamMap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("computation_params")
    .select("key, value")
    .eq("is_active", true);
  const map: ParamMap = {};
  for (const r of (data ?? []) as { key: string; value: number }[]) {
    map[r.key] = Number(r.value);
  }
  return map;
}

/**
 * The single SOA entry point. Driver switch (COMPUTATION_DRIVER = local | n8n);
 * n8n failures fall back to local so a down VPS never blocks a computation.
 * Both drivers return the same SOAResult shape; params_version + source are
 * stored on buyer_soa so historical SOAs stay reproducible after rules change.
 */
export async function computeSOA(input: SOAInput): Promise<SOAResult> {
  const params = await loadParams();

  if (serverEnv.computationDriver === "n8n") {
    const viaN8n = await computeViaN8n(input);
    if (viaN8n) {
      return { ...viaN8n, params_version: params.params_version ?? viaN8n.params_version ?? 1 };
    }
    // Log the fallback so it's visible in the audit trail.
    await logAudit({
      action: "update",
      entity: "computation",
      entityId: null,
      diff: { note: "n8n driver unavailable — fell back to local" },
    }).catch(() => {});
  }

  return computeLocal(input, params);
}
