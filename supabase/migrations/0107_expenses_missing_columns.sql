-- =============================================================================
-- 0107 · Add missing columns to expenses that 0105 forgot
-- =============================================================================
-- Migration 0105 extended public.expenses with category/vendor FK columns and
-- source/approval_status but omitted `description` (the free-text label used by
-- the new General Expenses form) and `created_by` (the inserting user's id).
-- Both are required by lib/expenses/actions.ts inserts.

alter table public.expenses
  add column if not exists description text,
  add column if not exists created_by  uuid references auth.users(id) on delete set null;

-- Back-fill description for any legacy rows so existing data stays readable.
update public.expenses
set description = coalesce(
  nullif(trim(
    case
      when category is not null and vendor is not null then category || ' – ' || vendor
      when category is not null then category
      when vendor   is not null then vendor
      else null
    end
  ), ''),
  'Legacy expense'
)
where description is null;

-- Back-fill created_by from entered_by for legacy rows.
update public.expenses
set created_by = entered_by
where created_by is null and entered_by is not null;

create index if not exists idx_expenses_created_by on public.expenses(created_by);
