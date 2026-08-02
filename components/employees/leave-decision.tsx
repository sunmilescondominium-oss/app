"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideLeave } from "@/app/(app)/employees/actions";

export function LeaveDecision({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(status: "approved" | "rejected") {
    const note = status === "rejected" ? window.prompt("Reason (optional):") || undefined : undefined;
    setBusy(true);
    const res = await decideLeave(id, status, note);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => act("approved")}
        disabled={busy}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        onClick={() => act("rejected")}
        disabled={busy}
        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
