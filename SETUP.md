# Sun Miles PMS — Setup (M0 Foundation)

Sun Miles Property Management Corporation — powered by BizAutoFlow.

This is the **M0 Foundation** milestone: Supabase schema + RLS, staff auth,
role-based access control, and a mobile-first, role-aware app shell. Modules
1A–10 are gated and stubbed with clearly-labeled milestone placeholders.

## Prerequisites

- Node.js 20+ (developed on v24) and npm
- A Supabase project (free tier is fine)

## 1. Install

```bash
npm install
```

## 2. Configure environment

Your secrets go in **`.env.local`** (git-ignored). Never paste them into chat or
commit them. Fill these from your Supabase dashboard:

| Variable | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (server-only) |
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string → **URI** (used only by the migration/seed scripts) |
| `BOOTSTRAP_OWNER_EMAIL` / `BOOTSTRAP_OWNER_PASSWORD` | You choose — the first owner/admin login |

`ALERT_EMAIL_DRIVER=resend` and `COMPUTATION_DRIVER=local` are safe defaults; flip
them later with no redeploy. `N8N_COMPUTATION_WEBHOOK_URL` and `RESEND_API_KEY`
can stay empty until those integrations are wired.

## 3. Create the schema

Applies every SQL file in `supabase/migrations` (no Supabase CLI required):

```bash
npm run db:push
```

## 4. Seed roles + the bootstrap owner

Seeds the 18 canonical roles and creates your first login (owner + admin):

```bash
npm run seed
```

## 5. Run

```bash
npm run dev
```

Open http://localhost:3000, sign in with `BOOTSTRAP_OWNER_EMAIL` /
`BOOTSTRAP_OWNER_PASSWORD`. As owner+admin you'll land on the first module your
roles can access.

## What M0 gives you

- **Role-based, never person-based.** No staff name in code, schema, seed, or UI.
  Reassigning a person = one row in `user_roles`.
- **18 roles** seeded from a table (add a role = one INSERT, no migration).
- **Auth** (Supabase email/password), session refresh via `proxy.ts` (Next 16's
  renamed middleware), and `requireAuth` / `requireModule` server guards.
- **RLS on every table**, with `has_role()` / `has_any_role()` SQL helpers for
  later modules.
- **Role-aware shell**: the left nav shows only modules your role(s) may open.
  The single RBAC map lives in `lib/rbac/modules.ts`.
- **Brand**: only `APP_BRAND` surfaces. GHL never appears.

## Verify (optional)

```bash
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## Troubleshooting

- **`db:push` / `seed` fail on an esbuild/tsx error** — dependency install
  scripts may be gated. Run `npm rebuild esbuild` then retry.
- **`Missing/placeholder env var` at runtime** — a required key in `.env.local`
  is still a placeholder. Fill it in.
- **Auth trigger error on `db:push`** — the migration creates a trigger on
  `auth.users`; make sure `SUPABASE_DB_URL` is the Postgres URI (the `postgres`
  role), not a restricted connection.

## Alerts & the 6 PM collections check (M2)

The "daily summary not submitted by 6 PM" alert runs via a scheduled call to
`/api/cron/collections-check`, protected by `CRON_SECRET`.

- Set `CRON_SECRET`, `RESEND_API_KEY`, and `ALERT_EMAIL_TO` in your env.
- On Vercel, `vercel.json` already schedules it daily at 10:00 UTC (6 PM Manila);
  Vercel Cron sends `CRON_SECRET` automatically as a Bearer token.
- Test locally: `curl "http://localhost:3000/api/cron/collections-check?key=YOUR_CRON_SECRET"`.
- Switch email transport with `ALERT_EMAIL_DRIVER=resend|n8n` — no redeploy.

Load sample collections for a live demo: `npm run seed:demo`.

## Roadmap (this build)

M1 Inventory · M2 Collections + Transmittal · M3 Buyer Account + PIN portal ·
M4 Document Tracker · M5 Dispute log · M6 Owner Dashboard · M7 Repair-request
portal.
