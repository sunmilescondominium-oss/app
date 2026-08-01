import type { GateStatus } from "./gates";

export interface DocumentType {
  id: string;
  category: string;
  name: string;
  sort_order: number;
  milestone_gate: string | null;
  is_sensitive_id: boolean;
}

export interface BuyerDocument {
  id: string;
  buyer_id: string;
  document_type_id: string;
  status: string;
  file_path: string | null;
  ref_number: string | null;
  doc_date: string | null;
  notes: string | null;
}

export interface FolderRow {
  type: DocumentType;
  doc: BuyerDocument | null;
}

export interface BuyerFolder {
  buyer: {
    id: string;
    contact_label: string;
    unit_number: string | null;
    id_consent_at: string | null;
  };
  rows: FolderRow[];
}

export interface FolderSummaryItem {
  buyer_id: string;
  contact_label: string;
  unit_number: string | null;
  total: number;
  done: number;
  gates: GateStatus[];
}
