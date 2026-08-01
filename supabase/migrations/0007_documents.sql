-- =============================================================================
-- Migration 0007 — Document Tracker per condo buyer (M4)
--
-- document_types catalog (adding a type = one row) + per-buyer buyer_documents
-- with a status lifecycle. Scans live in a PRIVATE storage bucket (created in
-- the seed script); access is via server-issued signed URLs only. RA 10173:
-- consent (buyers.id_consent_at) is required before storing sensitive IDs.
--
-- Idempotent.
-- =============================================================================

create table if not exists public.document_types (
  id              uuid primary key default gen_random_uuid(),
  category        text not null,
  name            text not null,
  sort_order      integer not null default 100,
  milestone_gate  text check (milestone_gate is null
                              or milestone_gate in ('reservation', 'cts', 'loan', 'title')),
  is_sensitive_id boolean not null default false,   -- gov IDs: needs consent
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (category, name)
);

create table if not exists public.buyer_documents (
  id               uuid primary key default gen_random_uuid(),
  buyer_id         uuid not null references public.buyers(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id) on delete restrict,
  status           text not null default 'pending'
                   check (status in ('not_required', 'pending', 'received',
                                     'signed', 'filed', 'overdue', 'disputed')),
  file_path        text,
  ref_number       text,
  doc_date         date,
  notes            text,
  uploaded_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (buyer_id, document_type_id)
);
create index if not exists idx_buyer_documents_buyer on public.buyer_documents(buyer_id);

drop trigger if exists trg_buyer_documents_updated_at on public.buyer_documents;
create trigger trg_buyer_documents_updated_at
  before update on public.buyer_documents
  for each row execute function public.set_updated_at();

-- RA 10173 consent to store IDs (captured before any sensitive upload).
alter table public.buyers add column if not exists id_consent_at timestamptz;

-- ---------------------------------------------------------------------------
-- RLS — mirrors lib/rbac/modules.ts (module "documents").
-- document_types: read all staff · write admin
-- buyer_documents: read admin/accounting/consultant/managing_officer · write admin/accounting
-- storage: NO authenticated policies — all access via service role in server
-- actions (private bucket, signed URLs).
-- ---------------------------------------------------------------------------
alter table public.document_types  enable row level security;
alter table public.buyer_documents enable row level security;

drop policy if exists document_types_select on public.document_types;
create policy document_types_select
  on public.document_types for select to authenticated
  using (public.is_staff());

drop policy if exists document_types_write on public.document_types;
create policy document_types_write
  on public.document_types for all to authenticated
  using (public.has_any_role(array['admin']))
  with check (public.has_any_role(array['admin']));

drop policy if exists buyer_documents_select on public.buyer_documents;
create policy buyer_documents_select
  on public.buyer_documents for select to authenticated
  using (public.has_any_role(array['admin', 'accounting', 'consultant', 'managing_officer']));

drop policy if exists buyer_documents_write on public.buyer_documents;
create policy buyer_documents_write
  on public.buyer_documents for all to authenticated
  using (public.has_any_role(array['admin', 'accounting']))
  with check (public.has_any_role(array['admin', 'accounting']));
