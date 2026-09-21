# Chrono

One place where a freelancer manages clients, projects, time, tasks, leave and
invoices. A task links to time, time links to an invoice, leave links to the
calendar and to working-day counts.

Read [`PRD.md`](PRD.md) for what it does, [`DESIGN.md`](DESIGN.md) for every
visual decision, and [`CLAUDE.md`](CLAUDE.md) for the rules the code follows.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth,
Storage) · dnd-kit · `@react-pdf/renderer` · `next-intl`.

## Local setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

There is no Docker-based local stack here, so this uses a hosted project.
Create one at [supabase.com/dashboard](https://supabase.com/dashboard); a region
near your users is best (`eu-west-3` Paris suits Tunisia and France).

### 3. Apply the schema

SQL Editor → New query → paste **all** of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → Run.

It is not idempotent: run it once, on a fresh project. It creates 12 tables with
RLS enabled, the triggers, `issue_invoice()`, `delete_account()`, and the two
private storage buckets.

Afterwards, check in the dashboard:

- Table Editor shows 12 tables, each with the green **RLS enabled** badge
- Storage shows `invoices` and `logos`, both **not** public

Later schema changes go in `supabase/migrations/0002_*.sql` and so on. Never
edit a migration that has been applied.

### 4. Google sign-in

**In [Google Cloud Console](https://console.cloud.google.com):**

1. APIs & Services → **OAuth consent screen**. In the current console this
   page is called **Google Auth Platform**, and the External/Internal choice
   lives under **Audience**. If your Google account is not part of a Google
   Workspace organisation there is no Internal option at all, so the project is
   External already and you will not be offered the choice.
2. While the app is in **Testing**, only addresses listed under
   **Audience → Test users** can sign in. Add your own address, and the second
   address you will use to check that RLS blocks another user.
3. Credentials → Create credentials → **OAuth client ID** → Web application.
   - Authorised JavaScript origins: `https://<your-ref>.supabase.co` and
     `http://localhost:3000`
   - Authorised redirect URIs: `https://<your-ref>.supabase.co/auth/v1/callback`

   That redirect URI is Supabase's callback, not this app's. A wrong value here
   is the usual cause of `redirect_uri_mismatch`.

**In the Supabase dashboard:**

4. Authentication → Providers → **Google**: enable it, paste the client ID and
   secret, Save. Until you do, the sign-in button reports that the provider is
   off, and `/auth/v1/settings` on your project reports `"google": false`.
5. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/auth/callback`

### 5. Environment

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API Keys → the `anon` / publishable key |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, only used by `npm run seed`. Never imported by app code. |

`.env.local` and `.env` are both gitignored. The service role key is server-only
and must never gain a `NEXT_PUBLIC_` prefix.

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000>. You will be redirected to `/sign-in`.

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
npm run verify      # the live project: providers, RLS, schema, buckets
```

`npm run verify` talks to the Supabase project in your env file and reports
whether Google is enabled, whether `anon` is refused on all 12 tables, whether
the functions and buckets exist. Run it after changing anything in the
dashboard.

## The RLS check

The database is the referee, so it gets its own test.

SQL Editor → paste all of
[`supabase/tests/rls_check.sql`](supabase/tests/rls_check.sql) → Run.

It creates two throwaway auth users, has one of them build a client, project,
board, time entries, leave and two invoices, then tries every way it can think
of to reach that data as the second user and as a signed-out visitor. It also
checks the invoice locks: editing an issued invoice, deleting its lines,
changing billed time, moving the status backwards. Both users are deleted at the
end.

The last result grid must read **`RLS check passed`** with `failed = 0`.

Re-run it after every migration.

## Seed data

```bash
npm run seed
```

Fills the signed-in account with a realistic freelancer's history: Tunisian and
French clients, projects in TND and EUR with a real paused period, logged time
across several weeks, leave including public holidays, a board with tasks, one
issued invoice and one draft. Requires `SUPABASE_SERVICE_ROLE_KEY`.

It is additive and safe to run on an empty account. Pass `--reset` to clear the
account's rows first.

## Layout

```
messages/            fr.json and en.json. All UI text lives here.
src/app/             routes. (app)/ is everything behind sign-in.
src/components/      ui/ primitives, shell/ the sidebar
src/i18n/            next-intl request config and the locale cookie
src/lib/             Supabase clients, money, durations, database types
supabase/migrations/ schema, applied in order, never edited after the fact
supabase/tests/      the RLS check
```

## Conventions

- Money is `numeric` in Postgres and scaled `bigint` in code, never a float.
  Use `src/lib/money.ts`.
- Durations are whole minutes everywhere. Use `src/lib/duration.ts`.
- Colours, sizes and radii come from the tokens in `src/app/globals.css`.
  Tailwind's default palette and type scale are cleared, so anything outside
  `DESIGN.md` fails to compile.
- CSS logical properties only (`ms-`/`me-`, not `ml-`/`mr-`), so RTL can be
  added later.
- All strings go through `next-intl`. Both `messages/fr.json` and
  `messages/en.json` must carry every key.
