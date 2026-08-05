"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { assignRepair, setRepairStatus, uploadRepairPhoto } from "@/app/(app)/repairs/actions";
import { CameraCapture } from "@/components/capture/camera-capture";
import type { RepairRequest } from "@/lib/repairs/types";
import { t, type Lang } from "@/lib/i18n";

const STATUS_CLS: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-800",
  assigned: "bg-blue-100 text-blue-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-emerald-100 text-emerald-800",
};
const STATUS_KEY: Record<string, string> = {
  submitted: "rp_st_submitted",
  assigned: "rp_st_assigned",
  in_progress: "rp_st_in_progress",
  completed: "rp_st_completed",
};
const URGENCY_KEY: Record<string, string> = {
  low: "rp_u_low",
  normal: "rp_u_normal",
  urgent: "rp_u_urgent",
};
const URGENCY_CLS: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  normal: "bg-stone-200 text-stone-700",
  urgent: "bg-red-100 text-red-700",
};

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export function RepairsBoard({
  requests,
  canWrite,
  lang = "en",
}: {
  requests: RepairRequest[];
  canWrite: boolean;
  lang?: Lang;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const tr = (k: string) => t(lang, k);

  async function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(id);
    const r = await fn();
    setBusy(null);
    if (!r.ok) {
      window.alert(r.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  function onAssign(e: ChangeEvent<HTMLSelectElement>, id: string) {
    const role = e.target.value;
    if (!role) return;
    run(id, () => assignRepair(id, role));
  }

  return (
    <div className="table-wrap">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">{tr("rp_ticket")}</th>
            <th className="px-4 py-3">{tr("rp_unit")}</th>
            <th className="px-4 py-3">{tr("rp_issue")}</th>
            <th className="px-4 py-3">{tr("rp_urgency")}</th>
            <th className="px-4 py-3">{tr("rp_requester")}</th>
            <th className="px-4 py-3">{tr("rp_assigned")}</th>
            <th className="px-4 py-3">{tr("col_status")}</th>
            {canWrite && <th className="px-4 py-3 text-right">{tr("rp_action")}</th>}
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 && (
            <tr>
              <td colSpan={canWrite ? 8 : 7} className="px-4 py-10 text-center text-stone-500">
                {tr("rp_no_requests")}
              </td>
            </tr>
          )}
          {requests.map((r) => (
            <tr key={r.id} className="border-b border-stone-100 last:border-0 align-top">
              <td className="px-4 py-3 font-medium text-stone-900">
                {r.ticket_ref}
                {r.photo_path && (
                  <a
                    href={`/api/repairs/${r.id}/photo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs font-medium text-amber-700 hover:underline"
                  >
                    {tr("rp_photo")}
                  </a>
                )}
                <RepairPhotos r={r} canWrite={canWrite} lang={lang} />
              </td>
              <td className="px-4 py-3">{r.unit?.unit_number ?? r.requester_ref ?? "—"}</td>
              <td className="px-4 py-3">
                <p>{r.issue_type}</p>
                <p className="mt-0.5 max-w-xs text-xs text-stone-500">{r.description}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_CLS[r.urgency] ?? ""}`}>
                  {tr(URGENCY_KEY[r.urgency] ?? "")}
                </span>
              </td>
              <td className="px-4 py-3 capitalize">{r.requester_type}</td>
              <td className="px-4 py-3">{roleLabel(r.assigned_to_role)}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[r.status] ?? ""}`}>
                  {tr(STATUS_KEY[r.status] ?? "")}
                </span>
              </td>
              {canWrite && (
                <td className="px-4 py-3 text-right">
                  {r.status === "submitted" && (
                    <select
                      defaultValue=""
                      onChange={(e) => onAssign(e, r.id)}
                      disabled={busy === r.id}
                      className="rounded-lg border border-stone-300 px-2 py-1 text-xs"
                    >
                      <option value="">{tr("rp_assign_to")}</option>
                      <option value="electrician">{tr("rp_electrician")}</option>
                      <option value="utility">{tr("rp_utility")}</option>
                    </select>
                  )}
                  {r.status === "assigned" && (
                    <button
                      type="button"
                      onClick={() => run(r.id, () => setRepairStatus(r.id, "in_progress"))}
                      disabled={busy === r.id}
                      className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                    >
                      {tr("rp_start_work")}
                    </button>
                  )}
                  {r.status === "in_progress" && (
                    <button
                      type="button"
                      onClick={() => run(r.id, () => setRepairStatus(r.id, "completed"))}
                      disabled={busy === r.id}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {tr("rp_complete")}
                    </button>
                  )}
                  {r.status === "completed" && <span className="text-xs text-stone-400">{tr("rp_done")}</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Before/after repair photos — view + (for staff) upload from the camera. */
function RepairPhotos({ r, canWrite, lang = "en" }: { r: RepairRequest; canWrite: boolean; lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const kindLabel = (kind: "before" | "after") => tr(kind === "before" ? "rp_before" : "rp_after");
  async function onCapture(kind: "before" | "after", file: File, capturedAt: string) {
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("captured_at", capturedAt);
    const res = await uploadRepairPhoto(r.id, kind, fd);
    if (!res.ok) return window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
      {(["before", "after"] as const).map((kind) => {
        const has = kind === "before" ? r.before_photo_path : r.after_photo_path;
        return (
          <span key={kind} className="flex items-center gap-1.5">
            {has ? (
              <a href={`/api/repairs/${r.id}/photo?kind=${kind}`} target="_blank" rel="noreferrer" className="font-medium text-amber-700 hover:underline">
                {kindLabel(kind)} ✓
              </a>
            ) : (
              <span className="text-stone-400">{kindLabel(kind)}</span>
            )}
            {canWrite && (
              <CameraCapture
                label={`Repair · ${kind} · ${r.issue_type}`}
                buttonText={has ? `${tr("rp_retake")} ${kindLabel(kind)}` : `${kindLabel(kind)} ${tr("rp_photo")}`}
                facingMode="environment"
                onCapture={(f, at) => onCapture(kind, f, at)}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
