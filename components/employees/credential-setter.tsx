"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeCredentials } from "@/app/(app)/employees/actions";

export function CredentialSetter({
  userId,
  employeeNo,
  hasPasscode,
  canEditId = false,
}: {
  userId: string;
  employeeNo: string | null;
  hasPasscode: boolean;
  canEditId?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [emp, setEmp] = useState(employeeNo ?? "");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setEmployeeCredentials(userId, emp, pass);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setPass("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        {employeeNo ? `ID ${employeeNo}${hasPasscode ? " ✓" : ""}` : "Set ID / PIN"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {canEditId ? (
        <input
          value={emp}
          onChange={(e) => setEmp(e.target.value)}
          placeholder="ID no."
          className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-amber-500"
        />
      ) : (
        <span className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-500" title="Only the consultant can change the ID">
          ID {emp || "—"}
        </span>
      )}
      <input
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        type="password"
        placeholder={hasPasscode ? "Reset PIN" : "PIN"}
        className="w-20 rounded-lg border border-stone-300 px-2 py-1 text-xs outline-none focus:border-amber-500"
      />
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-stone-400 hover:underline">✕</button>
    </div>
  );
}
