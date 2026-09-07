-- ============================================================
-- 0106 · Requisitions (Petty Cash / Check Payment Requests)
-- ============================================================

create table if not exists public.pmt_requests (
  id                      uuid primary key default gen_random_uuid(),
  link_token              uuid not null default gen_random_uuid(),
  created_by              uuid not null references auth.users(id) on delete restrict,
  requestor_user_id       uuid not null references auth.users(id) on delete restrict,
  expires_at              timestamptz not null,

  -- Pre-filled by accounting when creating the form
  payee_name              text,
  purpose                 text,
  payment_type            text check (payment_type in ('check', 'petty_cash')),

  -- Primary budget source
  primary_source_type     text check (primary_source_type in ('bank', 'petty_cash')),
  primary_source_id       uuid,
  primary_source_amount   numeric(14,2),

  -- Secondary source (if primary is insufficient)
  secondary_source_type   text check (secondary_source_type in ('bank', 'petty_cash')),
  secondary_source_id     uuid,
  secondary_source_amount numeric(14,2),

  -- Filled by requestor on submission
  description             text,
  amount_requested        numeric(14,2),
  supporting_doc_url      text,
  submitted_at            timestamptz,

  -- Workflow status
  status text not null default 'pending'
    check (status in ('pending', 'submitted', 'approved', 'rejected', 'released')),

  -- Approval
  approval_note     text,
  rejection_reason  text,
  approved_by       uuid references auth.users(id) on delete set null,
  approved_at       timestamptz,

  -- Budget release (separate step after physical cash/check is handed over)
  budget_released_by  uuid references auth.users(id) on delete set null,
  budget_released_at  timestamptz,

  -- Linked expense record created on release (for P&L tracking)
  expense_id uuid references public.expenses(id) on delete set null,

  created_at timestamptz not null default now()
);

create unique index if not exists idx_requisitions_token     on public.pmt_requests(link_token);
create index if not exists idx_requisitions_requestor        on public.pmt_requests(requestor_user_id, created_at desc);
create index if not exists idx_requisitions_status           on public.pmt_requests(status, created_at desc);

-- ── Storage bucket for supporting docs ──────────────────────
insert into storage.buckets (id, name, public)
  values ('requisition-docs', 'requisition-docs', false)
  on conflict do nothing;

create policy "req_docs_read" on storage.objects for select using (
  bucket_id = 'requisition-docs' and
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_key in ('admin','accounting','managing_officer','consultant','owner')
  )
);

create policy "req_docs_write" on storage.objects for insert with check (
  bucket_id = 'requisition-docs'
);

-- ── RLS ─────────────────────────────────────────────────────
alter table public.pmt_requests enable row level security;

-- Authenticated staff: accounting/admin can see all; others see only their own
create policy "requisitions_read" on public.pmt_requests for select using (
  auth.uid() = requestor_user_id or
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_key in ('admin','accounting','managing_officer','consultant','owner')
  )
);

-- Only accounting/admin can create or modify
create policy "requisitions_write" on public.pmt_requests for all using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role_key in ('admin','accounting')
  )
);
