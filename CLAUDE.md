# CLAUDE.md

Chrono (codename): a multi-user platform where freelancers manage clients, projects, time, tasks, leave, and invoices in one linked system.

## Read first

- `PRD.md`: what to build, data model, links between features, build order
- `DESIGN.md`: every visual decision. The only source of truth for UI

Do not build anything listed as v2 or out of scope in the PRD.

## Stack

Next.js (App Router), TypeScript, Tailwind, Supabase (Postgres, Auth, Storage), Vercel, dnd-kit, `@react-pdf/renderer`, `next-intl`.

Not used, do not add: Zod, Resend or any email sender, any auth provider other than Google via Supabase, any UI kit or icon set other than what is listed in `DESIGN.md`.

## Rules

1. **Ask before adding a dependency.** Say what it is for and why nothing existing covers it.
2. **Ask when the spec is unclear.** Do not invent product behavior or visual choices. If `PRD.md` or `DESIGN.md` does not cover it, stop and ask.
3. **Database first.** Schema changes go in `supabase/migrations/` as new files, never edited after being applied. Every new table gets RLS enabled and its policies in the same migration.
4. **Validation** is done with Postgres constraints plus plain TypeScript checks in server code. No validation library.
5. **Money** is `numeric` in the database and handled as strings or integers of minor units in code. Never floats.
6. **Issued invoices are immutable**, enforced by database triggers. Never write app code that tries to bypass this.
7. **Never expose the Supabase service role key** to client code. Server only.
8. **All UI text** goes through `next-intl` (`messages/fr.json`, `messages/en.json`). No hardcoded strings.
9. **Design tokens only.** No color, font size, radius, or spacing outside `DESIGN.md`. Check section 11 (forbidden) and section 12 (checklist) before finishing any screen.
10. Use CSS logical properties, not left/right.
11. Small commits, one concern each. Work on one milestone from the PRD build order at a time.

## Definition of done for a feature

- Works for a signed-in user and is invisible to a different user (verify RLS with a second account)
- Empty, loading, and error states exist
- French and English strings both present
- Passes the design checklist in `DESIGN.md`
- Types check and lint passes

## Commands

Fill in once the project is scaffolded: dev server, type check, lint, Supabase migration apply, seed.

## Seed data

Use realistic freelancer data (clients, projects with paused periods, leave, mixed currencies). Never "John Doe" or "Acme".
