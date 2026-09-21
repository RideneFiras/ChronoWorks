# DESIGN.md

This file is the only source of visual decisions. If something is not defined here, ask before inventing it. Never fall back to framework or component-library defaults.

## 1. Direction

**Chronokeeper.** A quiet observatory for someone who keeps track of time for a living. Deep indigo surfaces, brass details like the fittings of an old instrument, and one cool teal that only ever means "time is live". Dense, calm, precise.

The mood comes from the idea of an ancient scholar who keeps time: night, brass, clockwork. It is a mood, not a theme park. Zilean the character is only an inspiration for the vibe. **No Riot assets, no champion art, no character likeness, no champion names anywhere in the product.**

**The one memorable thing** is the Week grid together with the timer dial (section 6). Everything else stays quiet on purpose.

Dark is the default and only theme in v1. Light mode is v2.

## 2. Color tokens

Defined once as CSS variables in `globals.css` and mapped in the Tailwind config. **No color may appear in code that is not in this table.** No Tailwind default palette classes.

| Token | Hex | Use |
|---|---|---|
| `--night` | `#12132A` | App background |
| `--panel` | `#1A1C3A` | Tables, panels, cards, sidebar |
| `--raised` | `#232650` | Popovers, dialogs, hover rows, paused pills |
| `--line` | `#2F3362` | All borders and dividers |
| `--ink` | `#ECE9F7` | Primary text |
| `--ink-muted` | `#9B9EC4` | Secondary text, placeholders, table headers |
| `--brass` | `#C8A04A` | Primary buttons, links, focus ring, selected state |
| `--brass-tint` | `#332F49` | Selected row, hover on brass elements |
| `--time` | `#5FC9C1` | Only for live time: running timer, today marker, currently logged total |
| `--green` / `--green-tint` | `#6FCF97` / `#1F3A33` | Active, paid |
| `--amber` / `--amber-tint` | `#E6B84F` / `#3A3222` | Due soon, warnings |
| `--red` / `--red-tint` | `#F08A7E` / `#43242D` | Overdue, destructive, errors |

Rules:
- Text on `--night`, `--panel` or `--raised` is `--ink` or `--ink-muted`. Text on a `--brass` button is `--night`.
- Brass means "you can act on this". Teal means "time is running or this is now". Never swap or mix these roles, and never use teal for decoration.
- Status colors are used only for status pills, warnings and validation.
- **No gradients anywhere, including gold gradients. No glow, no outer glow on buttons or inputs.** Depth comes from the `--night` / `--panel` / `--raised` steps and 1px borders.
- Invoice PDFs are the exception: white paper (see section 9).

## 3. Typography

Two families, clearly distinct, both self-hosted through `next/font`:

- **Spectral** (500, 600): page titles, the wordmark, the invoice title. Nothing else.
- **Hanken Grotesk** (400, 500, 600): everything else.

| Role | Family | Size / line height | Weight |
|---|---|---|---|
| Page title | Spectral | 26 / 34 | 600 |
| Section title | Hanken Grotesk | 16 / 24 | 600 |
| Body (default) | Hanken Grotesk | 14 / 22 | 400 |
| Table header, helper text | Hanken Grotesk | 12 / 16 | 500, `--ink-muted` |
| Numbers in tables and grids | Hanken Grotesk | 14 / 22 | 500, `font-variant-numeric: tabular-nums` |

Rules:
- Sentence case everywhere. **No all-caps labels, no tracked-out eyebrow text.**
- Never set numbers, buttons, table cells or form labels in Spectral.
- No gothic, blackletter, rune or "fantasy" fonts. No Roman numerals as decoration.
- No single word in a heading styled differently from the rest.
- All numbers use tabular figures and are right-aligned in tables.
- Text lines never exceed 72 characters.

## 4. Layout and shape

- **Shell**: fixed left sidebar on `--panel`, 224px, wordmark at the top, text labels with a 16px icon. Content area max width 1120px. Page header: title on the left, one primary action on the right.
- **Spacing scale**: 4, 8, 12, 16, 24, 32, 48. Nothing else.
- **Lists are tables**, not grids of cards. Row height 44px. Header row on `--night`, rows on `--panel`, 1px `--line` between rows.
- **Radius**: 4px for inputs and buttons; 8px for panels, dialogs and popovers; fully rounded only for status pills and the timer dial. No other values.
- **No shadows.** Separation is 1px `--line` plus the step between `--night`, `--panel` and `--raised`.
- **Do not chop content into identical rounded cards.** A page should not be a grid of same-sized boxes.
- **Icons**: `lucide-react`, 16px, stroke width 1.5, color inherits text.
- **Ornament budget**: the only decorative motifs allowed are the logo mark and the timer dial (both circles with a hand, see section 6). No starfields, particles, clock-face wallpapers, rune borders, parchment textures, or background illustrations.
- Use CSS logical properties so RTL can be added later.

## 5. Components

- **Primary button**: `--brass` background, `--night` text, 4px radius, 32px height (36px in dialogs). One primary button per view. Secondary: `--panel` with 1px `--line`, `--ink` text. Destructive: `--red` text on secondary, filled red only in the final confirm step.
- **Inputs**: 36px high, `--night` background, 1px `--line`. Focus: 2px `--brass` ring with 2px offset. Labels above the field, 12px, `--ink`. Errors below the field in `--red`, saying what is wrong and how to fix it.
- **Status pill**: tint background, matching text, 12px, weight 500, always with the word (never color alone).
  - Active: green. Done: `--ink-muted` on `--night`.
  - **Paused: `--ink-muted` on `--raised` with a pause glyph** (time stopped, so it goes cool and still).
  - Draft: `--ink-muted` on `--night`. Issued or sent: `--brass` on `--brass-tint`. Paid: green. Overdue: red. Due soon: amber.
- **Table**: sticky header, sortable columns marked by a small chevron, row hover `--raised`, selected `--brass-tint`. Row actions in one overflow menu.
- **Kanban**: columns 296px wide on `--night` with no border. Cards `--panel`, 1px `--line`, 8px radius, 12px padding. A dragged card gets a 1px `--brass` border. Every drag needs a keyboard alternative ("Move to" menu).
- **Dialogs and popovers**: `--raised` with 1px `--line`, max width 480px, actions right-aligned, Escape closes, focus trapped.
- **Toasts**: bottom right, one line, same verb as the action ("Invoice issued").
- **Empty states**: one sentence plus one action button. No illustration.

## 6. Signature elements

### The Week grid (home screen)

```
                 Mon 14   Tue 15   Wed 16   Thu 17   Fri 18   Sat  Sun  |  Total
 Client A / Site   4h       6h       .        2h       .                 |  12h
 Client B / App    4h       .        8h       .        6h                |  18h
 Internal          .        .        .        .        1h                |  1h
 ------------------------------------------------------------------------------
 Day total         8h       6h       8h       2h       7h                |  31h
 Leave                               ////////////////                    (hatched)
```

- Rows are projects (active ones, plus any with entries that week). Columns are days. Weekend columns are narrower.
- Click a cell to type a duration. Enter saves, Tab moves right. Accepted: `2`, `2h`, `1h30`, `90m`, and `0.5d` on daily-rate projects.
- **Today** is marked by a 2px `--time` line across the top of its column, like the hand of a sundial. Nothing else about the column changes.
- **Leave days** use a diagonal hatch (`--line` on `--night`) across the column. Logging on one shows an inline warning, not a blocking dialog.
- Paused projects appear only if they have entries that week, with the paused pill.
- Below the grid, one line: "Unbilled this week: 1,240 EUR across 2 clients" with a "Create invoice" button.
- Week navigation: previous, next, "This week". Keyboard: `[` and `]`.

### The timer dial

A 28px ring in the page header, always visible.
- **Stopped**: 1.5px `--line` ring, a play glyph in the center.
- **Running**: 1.5px `--time` ring that fills clockwise over each hour, elapsed time in tabular figures next to it, project name beside that. The ring is the only animated element in the product outside of state changes.
- No numerals, no tick marks, no glow. Stopping it creates an entry in the Week grid.

### Logo mark

A circle with a single hand at ten past. 1.5px `--brass` stroke, no fill, no numerals. Wordmark "Chrono" (codename) in Spectral 600 next to it. Do not generate any other logo art.

## 7. Motion

- No entrance animations on page load. No fade-and-slide on sections. No hover lift.
- State changes only: 120ms ease-out for hover, focus, expand, toggle. Dialogs fade at 150ms.
- The timer ring updates once per second and moves smoothly, nothing else loops or pulses.
- Drag and drop uses dnd-kit defaults, no bounce.
- Respect `prefers-reduced-motion`: transitions off, the ring updates in steps.

## 8. Copy

The theme lives in the visuals. **The words stay plain.**

- Sentence case, plain verbs, active voice. Name things how a freelancer says them.
- No time puns or fantasy language in the interface ("Your hours await", "Turn back the clock", "Chronicles"). The product name is the only time-flavored word.
- One name per action across the whole flow: button "Issue invoice", dialog title "Issue invoice", toast "Invoice issued".
- Vocabulary: Client, Project, Task, Time, Leave (Congé), Invoice (Facture), Day rate (TJM), Hourly rate. Same terms in both languages every time.
- Errors say what happened and how to fix it. They never apologize, and never say "Something went wrong" alone.
- Empty state example: "No projects yet. Create a project to start logging time."
- No exclamation marks and no filler ("Welcome back!").
- All strings live in `messages/fr.json` and `messages/en.json`.

## 9. Invoice PDF

Invoices are documents people print and send to clients, so they do not use the dark theme.

- A4, white paper, Hanken Grotesk for body, Spectral 600 for the word "Facture" or "Invoice" only. Text `#12132A`.
- One 1px `#C8A04A` rule under the header. No other color.
- Top left: logo (the user's, not ours) and seller identity. Top right: title, number, issue date, due date.
- Buyer block, then line items with hairline row borders in `#DCDCE6`: description, quantity, unit, unit price, VAT, amount. Numbers right-aligned and tabular.
- Totals right-aligned: subtotal, VAT by rate, stamp duty, withholding (only when used), total in bold.
- Footer: IBAN, payment terms, legal mentions for the tax profile, page number. No "Chrono" branding beyond a small optional line.
- Language follows the client's invoice language setting.

## 10. Accessibility floor

- Text contrast AA minimum (check `--ink-muted` on `--panel`). Status is never color alone.
- Visible keyboard focus everywhere, brass ring. Minimum hit area 32px.
- Everything reachable by keyboard. Grid cells navigable with arrow keys.
- Responsive down to 375px: sidebar becomes a top bar with a menu, tables scroll inside their container, the Week grid becomes a day list.

## 11. Forbidden

- Purple-to-blue or gold gradients. Any gradient wash.
- Glow, neon, bloom, particle effects, magic sparkles, starfield or nebula backgrounds.
- Clock-face or gear wallpaper, hourglass illustrations, rune borders, parchment textures, ornate frames.
- Fantasy, gothic, or blackletter fonts. Roman numerals as decoration.
- Identical rounded cards in a grid. Big-number stat cards with a gradient.
- ALL-CAPS eyebrow labels. Middle-dot meta strings ("A · B · C"). Arrows appended to button text.
- Emoji as icons. Decorative illustrations. Fade-up on scroll. Hover lift. Pulsing dots.
- Any Riot Games asset, champion art, ability icon, or champion name.
- Lorem ipsum, "Acme Inc", "John Doe". Use realistic freelancer data in seeds.
- Default shadcn colors, default Tailwind palette, default font stack.

## 12. Before shipping any screen, check

1. Every color and size comes from a token in this file.
2. It has nothing from section 11, and brass and teal keep their roles.
3. Empty, loading, and error states exist and follow section 8.
4. It works with keyboard only and at 375px.
5. French text fits without truncation (French runs about 20 percent longer).
