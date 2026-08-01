"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import {
  setUserRoles,
  createUser,
  setUserActive,
  type ActionResult,
} from "@/app/(app)/users/actions";
import { MODULE_LIST } from "@/lib/rbac/modules";
import type { ManagedUser, RoleOption } from "@/lib/users/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

/** Which module labels a role can open — shown as a task hint. */
function accessHint(roleKey: string): string {
  const mods = MODULE_LIST.filter((m) =>
    (m.read as readonly string[]).includes(roleKey),
  ).map((m) => m.label);
  return mods.length ? mods.join(", ") : "External portal only";
}

function RoleChecklist({
  roles,
  selected,
  onToggle,
  controlled,
}: {
  roles: RoleOption[];
  selected: Set<string>;
  onToggle?: (rk: string) => void;
  controlled: boolean;
}) {
  const staff = roles.filter((r) => r.is_staff);
  const external = roles.filter((r) => !r.is_staff);

  const renderGroup = (title: string, group: RoleOption[]) => (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {group.map((r) => (
          <label
            key={r.role_key}
            className="flex items-start gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          >
            <input
              type="checkbox"
              name={controlled ? undefined : "roles"}
              value={r.role_key}
              checked={controlled ? selected.has(r.role_key) : undefined}
              defaultChecked={controlled ? undefined : selected.has(r.role_key)}
              onChange={controlled ? () => onToggle?.(r.role_key) : undefined}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            <span>
              <span className="font-medium text-slate-800">{r.label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">
                {accessHint(r.role_key)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderGroup("Staff", staff)}
      {renderGroup("External", external)}
    </div>
  );
}

function EditRolesForm({
  user,
  roles,
  isSelf,
  onDone,
}: {
  user: ManagedUser;
  roles: RoleOption[];
  isSelf: boolean;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(user.roleKeys));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function toggle(rk: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(rk)) n.delete(rk);
      else n.add(rk);
      return n;
    });
  }

  async function save() {
    setPending(true);
    setError("");
    const res = await setUserRoles(user.id, [...selected]);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onDone();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {user.email} · <span className="font-medium">{user.displayLabel}</span>
      </p>
      {isSelf && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          You&apos;re editing your own account — removing your admin role will
          revoke your access.
        </p>
      )}
      <RoleChecklist roles={roles} selected={selected} onToggle={toggle} controlled />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save roles"}
        </button>
      </div>
    </div>
  );
}

function AddUserForm({
  roles,
  onDone,
}: {
  roles: RoleOption[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createUser, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Email *</label>
          <input name="email" type="email" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Temporary password *</label>
          <input name="password" type="text" required minLength={6} className={inputCls} placeholder="min 6 characters" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Display label</label>
          <input name="display_label" className={inputCls} placeholder="e.g. Front Desk, Owner" />
        </div>
      </div>
      <div>
        <p className={labelCls}>Roles</p>
        <RoleChecklist roles={roles} selected={new Set()} controlled={false} />
      </div>
      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}

type ModalState = { kind: "add" } | { kind: "edit"; user: ManagedUser } | null;

export function UsersTable({
  users,
  roles,
  canWrite,
  currentUserId,
}: {
  users: ManagedUser[];
  roles: RoleOption[];
  canWrite: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const roleLabel = new Map(roles.map((r) => [r.role_key, r.label]));
  const close = () => setModal(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  async function toggleActive(u: ManagedUser) {
    if (u.isActive && !window.confirm(`Deactivate ${u.email}?`)) return;
    setPendingId(u.id);
    const res = await setUserActive(u.id, !u.isActive);
    setPendingId(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {canWrite && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setModal({ kind: "add" })}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            + Add user
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Display label</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              {canWrite && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-slate-100 last:border-0 ${
                  u.isActive ? "" : "bg-slate-50/60 text-slate-400"
                }`}
              >
                <td className="px-4 py-3 font-medium text-slate-900">
                  {u.email}
                  {u.id === currentUserId && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                      you
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{u.displayLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.roleKeys.length === 0 && (
                      <span className="text-xs text-slate-400">no roles</span>
                    )}
                    {u.roleKeys.map((rk) => (
                      <span
                        key={rk}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                      >
                        {roleLabel.get(rk) ?? rk}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.isActive ? (
                    <span className="text-emerald-700">Active</span>
                  ) : (
                    <span className="text-slate-400">Inactive</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setModal({ kind: "edit", user: u })}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit roles
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        disabled={pendingId === u.id || u.id === currentUserId}
                        title={u.id === currentUserId ? "You can't deactivate yourself" : undefined}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        {u.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal?.kind === "add"} onClose={close} title="Add user">
        <AddUserForm roles={roles} onDone={done} />
      </Modal>

      <Modal
        open={modal?.kind === "edit"}
        onClose={close}
        title={modal?.kind === "edit" ? `Edit roles — ${modal.user.email}` : "Edit roles"}
      >
        {modal?.kind === "edit" && (
          <EditRolesForm
            user={modal.user}
            roles={roles}
            isSelf={modal.user.id === currentUserId}
            onDone={done}
          />
        )}
      </Modal>
    </div>
  );
}
