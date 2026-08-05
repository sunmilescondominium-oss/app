// Pure constants + types (client-safe).

export const PAYABLE_TYPES = [
  { key: "allowance", label: "Allowance" },
  { key: "referral_fee", label: "Referral fee" },
  { key: "commission", label: "Commission" },
  { key: "override", label: "Override" },
  { key: "marketing_fund", label: "Marketing fund" },
  { key: "incentive", label: "Incentive" },
  { key: "reward", label: "Reward" },
  { key: "other", label: "Other" },
] as const;
export type PayableType = (typeof PAYABLE_TYPES)[number]["key"];

export const PAYEE_KINDS = [
  { key: "broker", label: "Broker" },
  { key: "agent", label: "Agent" },
  { key: "salesperson", label: "Salesperson" },
  { key: "staff", label: "Staff" },
  { key: "supplier", label: "Supplier" },
  { key: "other", label: "Other" },
] as const;

export const PAYABLE_STATUS_TONE: Record<string, "amber" | "blue" | "green" | "slate"> = {
  pending: "amber", approved: "blue", released: "green", cancelled: "slate",
};

export type Payee = {
  id: string; name: string; kind: string; parentPayeeId: string | null; parentName: string | null;
  overrideRate: number; commissionRate: number; tin: string | null; contact: string | null; isActive: boolean;
};

export type Payable = {
  id: string; payeeId: string; payeeName: string; payeeKind: string;
  ptype: PayableType; amount: number; description: string | null; businessLine: string | null; refNo: string | null;
  parentPayableId: string | null; status: string;
  approvedByRole?: string | null; releaseOrNo: string | null; releaseMethod: string | null;
  createdAt: string; releasedAt: string | null;
};
