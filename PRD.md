# PRD: Chrono (codename, public name TBD)

Status: draft v1. Read this together with `DESIGN.md` (how it looks) and `CLAUDE.md` (rules for the AI).

## 1. What this is

One place where a freelancer manages everything about their work: clients, projects, time, tasks, leave, and invoices. Today they juggle a Google Sheet for hours, Trello for tasks, and Word or Canva for invoices. Here it is one connected system: a task links to time, time links to an invoice, leave links to the calendar and to working-day counts.

Started as an internal tool for a few freelancers. Now built as a multi-user product.

## 2. Users and markets

- **User**: an independent freelancer (developer, designer, consultant, etc.), working alone.
- **Markets at launch**: Tunisia and Europe (France first among European countries).
- **Languages**: French and English. Arabic and RTL are not in v1, but all CSS must use logical properties (`margin-inline-start`, not `margin-left`) so RTL can be added later.
- **Currencies**: TND, EUR, USD. Each project and invoice has its own currency. TND uses 3 decimals, others use 2.

## 3. Principles

1. **Linked, not siloed.** Every feature must read from or write to another one. If a feature does not connect to the rest, question it.
2. **Fast to log.** Logging an hour must take under 5 seconds from the home screen.
3. **Money is exact.** Amounts are stored as `numeric`, never floats. Issued invoices never change.
4. **The database is the referee.** Rules live in Postgres (constraints, RLS, triggers), not only in the UI.

## 4. Scope

### MVP (v1)

| Area | What it does |
|---|---|
| Auth | Google sign-in only, through Supabase Auth |
| Clients | Name, contact, billing address, tax identifiers, default currency |
| Projects | Belongs to a client. Status: active, paused, done. Rate: TJM, hourly, or fixed. Start and end dates. Status history with dates |
| Time | Manual entry (date, duration, project, note, optional task). Lives in a week grid. Start/stop timer as a second way to fill the same table |
| Boards | One kanban per project. Columns and tasks are drag and drop. Tasks have due date and estimate |
| Leave (congé) | Vacation, sick, other, public holiday. Full or half days. Date ranges |
| Invoices (factures) | Build from unbilled time or manual lines. Generate PDF, store it, download it. The user sends it themselves |
| Settings | Business identity, tax info, invoice numbering, language, default currency |

### v2 (not now, do not build)

Dashboard and revenue charts, quotes (devis) that convert to projects, expenses and re-billing, recurring projects and retainers, invoice reminders, sending email from the app, accountant export (CSV), dark mode, Arabic/RTL, teams.

### Explicitly out of scope

Email sending (no Resend for now), payment processing, bank sync, multiple sign-in methods, client-facing portal.

## 5. The links (the reason this product exists)

| From | To | Behavior |
|---|---|---|
| Task | Time entry | "Log time" button on a task card creates a time entry with `task_id` set |
| Time entry | Invoice | Invoice builder lists unbilled entries for a client and period. Issuing marks them `invoice_id` and locks them |
| Project rate | Invoice line | Rate is copied to the line at creation. Later rate changes do not alter existing lines |
| Project status | Time entry | Logging on a paused or done project shows a warning and offers to reactivate it |
| Project status | History | Each change writes a row with date and optional note, so "paused March 3 to May 12" can be shown |
| Leave | Time entry | Logging time on a leave day shows a warning. Leave days are excluded from working-day counts |
| Leave | Week grid | Leave days appear hatched in the grid |
| Client | Invoice | Client billing details are copied (snapshot) into the invoice at issue time |
| Invoice | Time entry | Deleting or editing entries attached to an issued invoice is blocked by the database |

## 6. Data model

All tables have `id uuid primary key default gen_random_uuid()`, `created_at`, and `user_id uuid not null references auth.users` (except child tables that inherit ownership through their parent, which still carry `user_id` for simple RLS). **RLS is enabled on every table in the same migration that creates it.** Policy: `user_id = auth.uid()` for select, insert, update, delete.

**profiles**: `id` (= auth user id), `display_name`, `locale` (fr|en), `country`, `default_currency`, `legal_name`, `address`, `tax_id`, `vat_number`, `iban`, `logo_path`, `invoice_prefix`, `payment_terms_days`, `hours_per_day` (default 8).

**clients**: `name`, `email`, `address`, `country`, `tax_id`, `vat_number`, `currency`, `notes`, `archived_at`.

**projects**: `client_id`, `name`, `description`, `status` (active|paused|done), `rate_type` (daily|hourly|fixed), `rate_amount numeric(12,3)`, `currency`, `start_date`, `end_date`.

**project_status_history**: `project_id`, `status`, `changed_on date`, `note`. Written by a trigger when `projects.status` changes.

**time_entries**: `project_id`, `task_id` (nullable), `entry_date`, `duration_minutes int check (> 0)`, `description`, `is_billable bool default true`, `invoice_id` (nullable). Durations are always stored in minutes. For daily-rate projects the UI shows days (`duration_minutes / (hours_per_day * 60)`).

**boards / board_columns / tasks**: one board per project, created with the project. Columns have `position`. Tasks have `column_id`, `position`, `title`, `description`, `due_date`, `estimate_minutes`, `completed_at`.

**leaves**: `type` (vacation|sick|other|public_holiday), `start_date`, `end_date`, `start_half bool`, `end_half bool`, `note`. Check `end_date >= start_date`.

**invoices**: `client_id`, `number`, `status` (draft|issued|sent|paid|cancelled), `issue_date`, `due_date`, `currency`, `subtotal`, `tax_total`, `stamp_duty`, `withholding`, `total`, `notes`, `pdf_path`, `issued_at`, `paid_at`, plus snapshot columns for seller and buyer details.

**invoice_lines**: `invoice_id`, `project_id` (nullable), `description`, `quantity`, `unit` (day|hour|unit), `unit_price`, `tax_rate`.

**invoice_counters**: `user_id`, `year`, `last_number`. Numbers are assigned at issue time inside a transaction, so there are no gaps. Format: `{prefix}-{year}-{0001}`.

**Database rules**
- Once an invoice is `issued`, a trigger blocks any update to its financial fields and to its lines, and blocks edits or deletes on its time entries. Status can only move forward: issued, sent, paid. Corrections happen through a credit note (v1.5, see open questions).
- Validation is done with `NOT NULL`, `CHECK`, foreign keys, and enums. No validation library.

## 7. Invoice rules by market

These are the fields the system must support. Exact legal wording must be checked with an accountant in each country before launch. Make every rate and mention configurable, not hardcoded.

**Always**: sequential number, issue date, seller and buyer identity and address, line descriptions, quantities, unit prices, totals, currency, payment terms and due date.

**Tunisia**: TND with 3 decimals, matricule fiscal for both parties, VAT lines by rate (multiple rates possible on one invoice), optional stamp duty (timbre fiscal) line, optional withholding tax (retenue à la source) line and net-to-pay amount.

**Europe**: VAT number for both parties, VAT rate per line, a "reverse charge" mention for B2B cross-border within the EU, a "VAT not applicable" mention field for exempt businesses. For France additionally: SIRET, late payment penalty rate, fixed recovery indemnity mention.

Implementation: a `tax_profile` setting per user (`tn`, `fr`, `eu_generic`) that toggles which fields and legal mentions appear. Start with `tn` and `fr`.

## 8. Screens (MVP)

1. **Week** (home): the time grid. Details in `DESIGN.md`.
2. **Projects**: table. Row opens project detail.
3. **Project detail**: tabs for Overview, Time, Board, Invoices. Header shows client, status, rate.
4. **Clients**: table, plus client detail with its projects and invoices.
5. **Invoices**: table with status filter. Invoice builder and invoice view.
6. **Leave**: calendar month view plus list.
7. **Settings**: profile, business identity, tax profile, numbering, language.

## 9. Tech stack

- Next.js (App Router) and TypeScript, hosted on Vercel
- Supabase: Postgres, Auth (Google provider only), Storage (invoice PDFs and logos)
- Tailwind CSS with tokens from `DESIGN.md` (dark theme only in v1). Radix primitives (via shadcn/ui) are allowed only if fully restyled to the tokens
- dnd-kit for the kanban and drag interactions
- PDF generation: `@react-pdf/renderer`, server side, stored in Supabase Storage
- i18n: `next-intl`, French and English
- No Zod. No Resend. No additional auth provider

## 10. Security

- RLS on every table, tested with a second user account before each release
- `user_id` on every table from day one
- Service role key is server only and never imported into client code
- Storage buckets are private. PDFs are served through short-lived signed URLs, and storage policies restrict paths to `{user_id}/...`
- Google OAuth redirect URLs restricted to the production domain and localhost
- Server Actions and route handlers re-check the session and do their own input checks with plain TypeScript; the database constraints are the final guard
- Account deletion and data export (GDPR) before public launch

## 11. Build order

1. Project setup, Supabase, Google sign-in, profiles, settings, RLS test harness
2. Clients and projects, status history
3. Time entries and the Week grid
4. Leave and its links to the grid
5. Boards and tasks, with "log time" from a task
6. Invoices: builder, numbering, lock, PDF, storage
7. Polish, empty states, French copy pass, security review

Each step ends with something usable and a check that RLS blocks another user.

## 12. Open questions

- Public product name (Chrono is a codename only; check trademark and domain availability before choosing)
- Are credit notes needed in v1 or v1.5? Recommendation: v1.5, but the schema should allow them
- Do freelancers in France need micro-entrepreneur mentions (franchise en base de TVA) at launch? Likely yes for the French market
- Pricing model for the SaaS (free tier limits, paid plan)
