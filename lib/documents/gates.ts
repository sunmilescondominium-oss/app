import { DOC_DONE_STATUSES, MILESTONE_GATES } from "@/lib/config";

export interface GateStatus {
  key: string;
  label: string;
  total: number;
  done: number;
  complete: boolean;
}

const DONE = new Set<string>(DOC_DONE_STATUSES);

/** Pure gate-completeness. A gate is complete when every gated doc that isn't
 *  "not required" is received/signed/filed. */
export function computeGates(
  docs: { milestone_gate: string | null; status: string }[],
): GateStatus[] {
  return MILESTONE_GATES.map((g) => {
    const gated = docs.filter(
      (d) => d.milestone_gate === g.key && d.status !== "not_required",
    );
    const done = gated.filter((d) => DONE.has(d.status)).length;
    return {
      key: g.key,
      label: g.label,
      total: gated.length,
      done,
      complete: gated.length > 0 && done === gated.length,
    };
  });
}
