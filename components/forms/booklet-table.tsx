"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { EditBooklet } from "@/components/forms/edit-booklet";
import { LOW_STOCK_THRESHOLD } from "@/lib/forms/types";
import type { BookletRow, FormType, BusinessEntity } from "@/lib/forms/types";

type Custodian = { userId: string; label: string; role: string | null };
type Role = { key: string; label: string };

interface Props {
  booklets: BookletRow[];
  canManage: boolean;
  types: FormType[];
  custodians: Custodian[];
  entities: BusinessEntity[];
  roles: Role[];
}

export function BookletTable({ booklets, canManage, types, custodians, entities, roles }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = booklets.find((b) => b.id === editingId) ?? null;

  return (
    <>
      {editing && canManage && (
        <EditBooklet
          booklet={editing}
          types={types}
          custodians={custodians}
          entities={entities}
          roles={roles}
          onClose={() => setEditingId(null)}
        />
      )}

      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Booklet</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Business</th>
            <th className="px-4 py-3">Serials</th>
            <th className="px-4 py-3">Custodian</th>
            <th className="px-4 py-3 text-right">Accounted</th>
            <th className="px-4 py-3">Status</th>
            {canManage && <th className="px-4 py-3 w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {booklets.length === 0 && (
            <tr>
              <td colSpan={canManage ? 8 : 7} className="px-4 py-8 text-center text-stone-500">
                No booklets registered yet.
              </td>
            </tr>
          )}
          {booklets.map((b) => (
            <tr key={b.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
              <td className="px-4 py-2.5 font-medium">
                <Link href={`/forms/${b.id}`} className="text-amber-700 hover:underline">{b.bookletNo}</Link>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone="slate">{b.typeCode}</Badge>{" "}
                <span className="text-xs text-stone-500">{b.typeName}</span>
              </td>
              <td className="px-4 py-2.5 text-xs text-stone-600">
                {b.entityName ?? <span className="text-stone-400">—</span>}
                {b.birAtpNo && <span className="block text-[11px] text-stone-400">ATP {b.birAtpNo}</span>}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs text-stone-600">
                {b.prefix}{b.from}–{b.prefix}{b.to}{" "}
                <span className="text-stone-400">({b.total})</span>
              </td>
              <td className="px-4 py-2.5 text-stone-600">
                {b.custodianLabel ?? <span className="text-stone-400">unassigned</span>}
                {b.custodianRole && <span className="block text-[11px] text-stone-400">{b.custodianRole.replace(/_/g, " ")}</span>}
                {(b.issuedToRole || b.issuedToLabel || b.businessLine) && (
                  <span className="block text-[11px] text-stone-400">
                    ↳ {b.issuedToLabel || b.issuedToRole?.replace(/_/g, " ")}{b.businessLine ? ` · ${b.businessLine}` : ""}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {b.accounted}/{b.total}
                <span className="block text-[11px] text-stone-400">{b.counts.unused} unused</span>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={b.status === "active" ? "green" : "slate"}>{b.status}</Badge>
                {b.reprintRequestedAt
                  ? <span className="mt-0.5 block text-[10px] font-semibold text-rose-600">reprint requested</span>
                  : b.status === "active" && b.counts.unused <= LOW_STOCK_THRESHOLD
                    && <span className="mt-0.5 block text-[10px] font-semibold text-amber-600">low — {b.counts.unused} left</span>}
              </td>
              {canManage && (
                <td className="px-2 py-2.5">
                  <button
                    onClick={() => setEditingId(b.id)}
                    className="rounded-lg px-2 py-1 text-xs text-stone-500 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                    title="Edit booklet"
                  >
                    ✏
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
