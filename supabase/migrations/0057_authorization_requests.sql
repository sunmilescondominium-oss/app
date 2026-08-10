-- 0057_authorization_requests.sql
-- Two-person authorization for high-risk corrections (collection edits,
-- transmittal reverts). The requestor passes the step-up gate (justification +
-- CONFIRM EDIT + employee-code/passcode); a managing officer or consultant then
-- approves or rejects from their dashboard. The change executes only on
-- approval. Every decision is fully audited.

create table if not exists public.authorization_requests (
  id              uuid primary key default gen_random_uuid(),
  type            text not null check (type in ('collection_edit', 'transmittal_revert')),
  entity_id       text not null,          -- collection id or transmittal id
  requested_by    uuid references auth.users(id) on delete set null,
  requester_role  text,
  justification   text not null,
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewer_role   text,
  reviewed_at     timestamptz,
  review_note     text,
  expires_at      timestamptz not null default (now() + interval '48 hours'),
  created_at      timestamptz not null default now()
);

create index if not exists idx_auth_req_status    on public.authorization_requests(status, created_at desc);
create index if not exists idx_auth_req_entity    on public.authorization_requests(entity_id);
create index if not exists idx_auth_req_requester on public.authorization_requests(requested_by);

alter table public.authorization_requests enable row level security;

drop policy if exists auth_req_select on public.authorization_requests;
create policy auth_req_select on public.authorization_requests for select to authenticated
  using (
    requested_by = auth.uid()
    or public.has_any_role(array['admin', 'managing_officer', 'consultant'])
  );
-- Writes go through service role in the actions only.

-- --- collection revert tracing ------------------------------------------------
-- Track how many times a collection has been freed from a transmittal revert
-- and which transmittal it was last freed from, so auditors can see the history.
alter table public.collections
  add column if not exists reverted_count            int not null default 0,
  add column if not exists last_reverted_from_ref    text;  -- 8-char short ref of the reverted transmittal
