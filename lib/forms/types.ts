// Pure constants + types (safe to import from client components).

export const SERIAL_STATUSES = ["unused", "used", "cancelled", "spoiled", "void"] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

export const SERIAL_TONE: Record<SerialStatus, string> = {
  unused: "bg-stone-100 text-stone-500",
  used: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-amber-100 text-amber-800",
  spoiled: "bg-orange-100 text-orange-800",
  void: "bg-rose-100 text-rose-700",
};

export type FormType = { id: string; code: string; name: string; birReportable: boolean };

export type BusinessEntity = { id: string; name: string; tradeName: string | null; tin: string | null; rdo: string | null; address: string | null };

/** Unused serials at or below this count flag a booklet as low → reprint. */
export const LOW_STOCK_THRESHOLD = 5;

export type BookletRow = {
  id: string; bookletNo: string; typeCode: string; typeName: string; typeBir: boolean;
  prefix: string; from: number; to: number; total: number;
  custodianLabel: string | null; custodianRole: string | null;
  businessLine: string | null; issuedToRole: string | null; issuedToLabel: string | null;
  status: string; counts: Record<SerialStatus, number>; accounted: number;
  entityId: string | null; entityName: string | null; entityTin: string | null;
  birAtpNo: string | null; birAtpDate: string | null; printerName: string | null;
  reprintRequestedAt: string | null;
};

export type SerialRow = {
  id: string; serialNo: number; label: string; status: SerialStatus;
  issuedTo: string | null; reference: string | null; amount: number | null;
  usedByRole: string | null; usedAt: string | null; remarks: string | null;
};

export type CustodyEntry = { fromLabel: string | null; toLabel: string | null; byLabel: string | null; at: string; note: string | null };
