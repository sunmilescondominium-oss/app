"use client";

import { useState, useTransition } from "react";
import { setRolePermission, clearRolePermission, setGroupPermission } from "@/app/(app)/admin/role-permissions/actions";
import type { ModuleRoleOverride } from "@/app/(app)/admin/role-permissions/actions";
import { ROLE_GROUPS } from "@/lib/rbac/modules";
import type { ModuleDef } from "@/lib/rbac/modules";

type Cell = { read: boolean; write: boolean; overridden: boolean };

function buildMatrix(
  modules: ModuleDef[],
  allRoles: string[],
  overrides: ModuleRoleOverride[],
): Record<string, Record<string, Cell>> {
  const m: Record<string, Record<string, Cell>> = {};
  for (const mod of modules) {
    m[mod.key] = {};
    for (const role of allRoles) {
      const override = overrides.find((o) => o.module_key === mod.key && o.role_key === role);
      if (override) {
        m[mod.key][role] = { read: override.can_read, write: override.can_write, overridden: true };
      } else {
        m[mod.key][role] = {
          read: (mod.read as readonly string[]).includes(role),
          write: (mod.write as readonly string[]).includes(role),
          overridden: false,
        };
      }
    }
  }
  return m;
}

export function RolePermissionMatrix({
  modules,
  overrides: initOverrides,
  canEdit,
}: {
  modules: ModuleDef[];
  overrides: ModuleRoleOverride[];
  canEdit: boolean;
}) {
  const [overrides, setOverrides] = useState<ModuleRoleOverride[]>(initOverrides);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState("");

  const allRoles = ROLE_GROUPS.flatMap((g) => g.roles as string[]);
  const matrix = buildMatrix(modules, allRoles, overrides);

  function toggleGroupExpand(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }

  function patchOverride(moduleKey: string, roleKey: string, canRead: boolean, canWrite: boolean) {
    setOverrides((prev) => {
      const next = prev.filter((o) => !(o.module_key === moduleKey && o.role_key === roleKey));
      next.push({ module_key: moduleKey, role_key: roleKey, can_read: canRead, can_write: canWrite });
      return next;
    });
  }

  function handleCellToggle(moduleKey: string, roleKey: string, type: "read" | "write") {
    if (!canEdit) return;
    const cell = matrix[moduleKey][roleKey];
    const newRead = type === "read" ? !cell.read : cell.read;
    const newWrite = type === "write" ? !cell.write : Math.min(cell.write ? 1 : 0, newRead ? 1 : 0) === 1;
    // write requires read
    const finalWrite = newWrite && newRead;

    startTransition(async () => {
      const res = await setRolePermission(moduleKey, roleKey, newRead, finalWrite);
      if (res.ok) {
        patchOverride(moduleKey, roleKey, newRead, finalWrite);
      } else {
        setErr(res.error ?? "Failed.");
      }
    });
  }

  function handleGroupToggle(moduleKey: string, groupRoles: readonly string[], on: boolean) {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await setGroupPermission(moduleKey, [...groupRoles], on, on);
      if (res.ok) {
        setOverrides((prev) => {
          const next = prev.filter(
            (o) => !(o.module_key === moduleKey && groupRoles.includes(o.role_key)),
          );
          for (const role of groupRoles) {
            next.push({ module_key: moduleKey, role_key: role, can_read: on, can_write: on });
          }
          return next;
        });
      } else {
        setErr(res.error ?? "Failed.");
      }
    });
  }

  function handleClearOverride(moduleKey: string, roleKey: string) {
    if (!canEdit) return;
    startTransition(async () => {
      const res = await clearRolePermission(moduleKey, roleKey);
      if (res.ok) {
        setOverrides((prev) =>
          prev.filter((o) => !(o.module_key === moduleKey && o.role_key === roleKey)),
        );
      }
    });
  }

  const visibleModules = modules.filter((m) => !m.hidden);

  return (
    <div className="space-y-2">
      {err && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-2.5 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-emerald-500" /> Read access</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-amber-500" /> Write access</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border-2 border-violet-400 bg-violet-50" /> Overridden from default</span>
        {canEdit && <span className="ml-auto text-stone-400">Click a cell to toggle · Click group header to expand roles</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="sticky left-0 z-10 bg-stone-50 px-4 py-3 text-left font-semibold text-stone-600 min-w-[160px]">
                Module
              </th>
              {ROLE_GROUPS.map((group) => (
                <th
                  key={group.key}
                  colSpan={expandedGroups.has(group.key) ? group.roles.length : 1}
                  className="border-l border-stone-200 px-2 py-2 text-center"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroupExpand(group.key)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-stone-700 hover:bg-stone-100"
                    title={group.description}
                  >
                    {group.label}
                    <span className="text-stone-400">{expandedGroups.has(group.key) ? "▴" : "▾"}</span>
                  </button>
                </th>
              ))}
            </tr>

            {/* Role sub-headers when group expanded */}
            {ROLE_GROUPS.some((g) => expandedGroups.has(g.key)) && (
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="sticky left-0 z-10 bg-stone-50/50 px-4 py-1" />
                {ROLE_GROUPS.map((group) =>
                  expandedGroups.has(group.key)
                    ? group.roles.map((role) => (
                        <th key={role} className="border-l border-stone-100 px-2 py-1 text-center font-normal text-stone-500 whitespace-nowrap">
                          {role.replace(/_/g, " ")}
                        </th>
                      ))
                    : <th key={group.key} className="border-l border-stone-100" />,
                )}
              </tr>
            )}
          </thead>

          <tbody>
            {visibleModules.map((mod) => (
              <tr key={mod.key} className="border-b border-stone-100 hover:bg-stone-50/40">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <p className="font-medium text-stone-700">{mod.label}</p>
                  <p className="text-[10px] text-stone-400">{mod.path}</p>
                </td>

                {ROLE_GROUPS.map((group) => {
                  if (!expandedGroups.has(group.key)) {
                    /* Collapsed — show group summary cell */
                    const groupRoles = group.roles as string[];
                    const cells = groupRoles.map((r) => matrix[mod.key][r]);
                    const anyRead = cells.some((c) => c.read);
                    const anyWrite = cells.some((c) => c.write);
                    const allRead = cells.every((c) => c.read);
                    const anyOverridden = cells.some((c) => c.overridden);

                    return (
                      <td key={group.key} className="border-l border-stone-100 px-2 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleGroupToggle(mod.key, group.roles, !allRead)}
                              title={allRead ? "Turn OFF group access" : "Turn ON group access"}
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                                allRead
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  : anyRead
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-stone-100 text-stone-400 hover:bg-stone-200"
                              } ${anyOverridden ? "ring-1 ring-violet-400" : ""}`}
                            >
                              {allRead ? "ON" : anyRead ? "~" : "OFF"}
                            </button>
                          )}
                          {!canEdit && (
                            <span className={`text-[10px] font-medium ${allRead ? "text-emerald-700" : anyRead ? "text-amber-600" : "text-stone-300"}`}>
                              {allRead ? "Full" : anyRead ? "Partial" : "—"}
                            </span>
                          )}
                          {anyWrite && <span className="text-[10px] text-amber-500" title="Has write access">W</span>}
                        </div>
                      </td>
                    );
                  }

                  /* Expanded — show per-role cells */
                  return (group.roles as string[]).map((role) => {
                    const cell = matrix[mod.key][role];
                    return (
                      <td key={role} className="border-l border-stone-100 px-1.5 py-2 text-center">
                        <div className={`inline-flex flex-col items-center gap-0.5 rounded p-0.5 ${cell.overridden ? "ring-1 ring-violet-300" : ""}`}>
                          <button
                            type="button"
                            disabled={!canEdit || isPending}
                            onClick={() => handleCellToggle(mod.key, role, "read")}
                            title="Toggle read"
                            className={`h-4 w-4 rounded border ${cell.read ? "border-emerald-500 bg-emerald-500" : "border-stone-300 bg-white"} disabled:cursor-default`}
                          />
                          <button
                            type="button"
                            disabled={!canEdit || isPending}
                            onClick={() => handleCellToggle(mod.key, role, "write")}
                            title="Toggle write"
                            className={`h-4 w-4 rounded border ${cell.write ? "border-amber-500 bg-amber-500" : "border-stone-300 bg-white"} disabled:cursor-default`}
                          />
                          {cell.overridden && canEdit && (
                            <button
                              type="button"
                              onClick={() => handleClearOverride(mod.key, role)}
                              title="Revert to default"
                              className="text-[9px] text-violet-500 hover:text-violet-700"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  });
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
