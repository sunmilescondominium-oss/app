"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setRolePermissions, resetRolePermissions, type ActionResult } from "@/app/(app)/users/access/actions";

export interface ModuleRow { key: string; label: string; blurb: string; read: boolean; write: boolean }
export interface RoleChoice { key: string; label: string }

export function PermissionEditor({ roles, selectedRole, modules }: { roles: RoleChoice[]; selectedRole: string; modules: ModuleRow[] }) {
  const router = useRouter();
  const bound = setRolePermissions.bind(null, selectedRole);
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(bound, undefined);
  const [rows, setRows] = useState(modules);
  useEffect(() => setRows(modules), [modules]);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  const set = (key: string, kind: "read" | "write", val: boolean) =>
    setRows((rs) => rs.map((r) => {
      if (r.key !== key) return r;
      if (kind === "write") return { ...r, write: val, read: val ? true : r.read };
      return { ...r, read: val, write: val ? r.write : false };
    }));

  const onRole = (key: string) => router.push(`/users/access?role=${encodeURIComponent(key)}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-stone-600">Role</label>
        <select value={selectedRole} onChange={(e) => onRole(e.target.value)} className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200">
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <form action={async () => { await resetRolePermissions(selectedRole); router.refresh(); }}>
          <button type="submit" className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50">Reset to defaults</button>
        </form>
      </div>

      <form action={act}>
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3 text-center">Read</th>
                <th className="px-4 py-3 text-center">Write</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.key} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800">{m.label}</p>
                    <p className="text-xs text-stone-400">{m.blurb}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" name={`read:${m.key}`} checked={m.read} onChange={(e) => set(m.key, "read", e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" name={`write:${m.key}`} checked={m.write} onChange={(e) => set(m.key, "write", e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
            {pending ? "Saving…" : "Save access"}
          </button>
          {state?.ok && <span className="text-sm text-emerald-700">Saved.</span>}
          {state && !state.ok && <span className="text-sm text-red-700">{state.error}</span>}
        </div>
      </form>
      <p className="text-xs text-stone-400">Ticking Write auto-grants Read. Changes take effect immediately across the nav and every page.</p>
    </div>
  );
}
