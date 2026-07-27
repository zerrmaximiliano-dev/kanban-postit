# Premium UI Redesign — Design Spec

Date: 2026-07-27
Status: Approved by user, pending implementation plan

## Goal

Redesign the entire kanban-postit interface to feel like a premium, production-grade SaaS
product (quality bar: Linear, Notion, Vercel, Stripe Dashboard) instead of a functional
prototype. Visual direction selected: **Option A — petrol blue structural chrome + turquoise
accent**, shown as a mockup and approved by the user.

Scope: full application (Sidebar, Topbar/BoardHeader, BoardTabs, Board columns/notes, Note
editor, Mini-calendar panel, full Calendar view, Login/Signup, and a shared component
language: buttons, inputs, selects, dropdowns, modals/drawers, alerts, badges, toasts).

## Design Tokens

### Color

Two independent color systems:

1. **Neutral base** (fixed, not user-configurable) — used for surfaces, text, borders on
   every screen regardless of board color.
   - `--color-bg`: `#FAFBFC` (page background)
   - `--color-surface`: `#FFFFFF` (cards, modals, popovers)
   - `--color-border`: `#E4E7EC`
   - `--color-border-strong`: `#D0D5DD`
   - `--color-text-primary`: `#101828`
   - `--color-text-secondary`: `#475467`
   - `--color-text-tertiary`: `#98A2B3`

2. **Accent** (fixed turquoise, independent of board color) — the *single* accent color used
   for interactive elements everywhere: primary buttons, links, focus rings, active tab
   underline, checked checkboxes, badge "info" variant.
   - `--accent-500`: `#14B8A6` (default/base)
   - `--accent-600`: `#0F9488` (hover/pressed)
   - `--accent-100`: `#CCFBF1` (light tint — badges, subtle backgrounds)

3. **Board theme (existing, stays editable)** — the current per-board color picker
   (`BOARD_COLOR_PRESETS` + custom hex, `getBoardPalette()`) is **kept as-is** and continues
   to drive `dark` / `medium` / `light` for that board's header, sidebar, and column accents.
   Only change: `DEFAULT_BASE` in `palette.ts` moves from the old muted blue-gray
   (`#5B6B8C`) to a petrol blue (`#1B4B5A`) so a fresh board starts on-theme with Option A
   instead of the old default. Nothing about the picker's mechanics changes — presets, custom
   hex input, and the grayscale-safe clamp fix all stay.

Semantic feedback colors (new, for alerts/toasts/badges):
   - Success: `#12B76A` / bg `#ECFDF3`
   - Danger: `#F04438` / bg `#FEF3F2`
   - Warning: `#F79009` / bg `#FFFAEB`

### Typography

- Font stays **Inter** everywhere (already installed, matches Linear/Vercel). Note titles in
  the board preview keep **Caveat** — approved to stay as the one "personality" accent.
- Scale (Inter):
  - Display (board title `<h1>`): 24px / 1.25 / weight 700
  - Heading (modal/section titles): 16px / 1.4 / weight 600
  - Label (column titles, uppercase small-caps style): 12px / 1.4 / weight 700 / tracking-wide
  - Body: 14px / 1.5 / weight 400–500
  - Small/meta (dates, counts): 12px / 1.4 / weight 500
  - Note title (Caveat, unchanged): 20px / weight 700

### Spacing

8px base grid throughout, mapped to Tailwind's default scale so no config changes are
needed: `1`=4px, `2`=8px, `3`=12px, `4`=16px, `6`=24px, `8`=32px, `12`=48px. Pass over
existing components to replace any off-grid spacing (e.g. stray `py-1.5`, `p-1.5`) with
grid-aligned values where it doesn't break existing dense layouts (small icon buttons may
keep 6px/`1.5` for touch-target reasons — documented as the one accepted exception).

### Radius

- Cards, modals, drawers, popovers: `16px` (Tailwind `rounded-2xl`)
- Inputs, buttons, badges, small tiles (calendar day cells): `10px` (custom `rounded-[10px]`)
- Pills (badges, tags): fully rounded (`rounded-full`)

### Shadow

Two elevation levels only — never stack more:
- `--shadow-sm` (resting): `0 1px 2px rgba(16,24,40,0.04)`
- `--shadow-md` (hover / elevated / open popover): `0 4px 12px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)`

### Motion

- Duration: `150ms` (micro, e.g. button hover) to `250ms` (panel/drawer open, tab switch)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (standard "ease-out" feel, registered once as a
  Tailwind/CSS token, reused everywhere — no bespoke easings per component)
- Effects allowed: fade, slide (drawers/toasts), scale ≤ 1.04 (hover lift), opacity. No
  bounce, no spin-in, nothing attention-grabbing.
- Existing drag-and-drop animations (column reorder, calendar drop, note translucency
  reveal) are **not** touched by this redesign — they were tuned separately and already
  match this motion philosophy.

## Component Redesign Notes

**Sidebar** — petrol gradient background (`dark` → slightly darker), turquoise square as the
app mark, board list rows get `rounded-lg` hover state (`bg-white/8`) and an active-board
left accent bar in turquoise + `bg-white/12`. Collapse toggle becomes a real chevron icon
(not `«`/`»` ASCII). "Crear tablero" button restyled as a filled turquoise primary button
with hover elevation and a spinner + disabled state while pending.

**BoardHeader/Topbar** — board's `dark` tone as background (unchanged mechanism), title at
the new Display scale. Color-swatch trigger becomes a real icon button (palette icon,
tooltip "Cambiar color"). The popover is rebuilt as a proper card: `rounded-2xl`,
`shadow-md`, swatches get a hover scale + ring-on-select, and the custom color input gets a
visible label instead of a bare `<input type=color>`.

**BoardTabs** — replaced with a proper underline/segmented control: active tab gets a
turquoise underline + bold text, inactive stays `text-secondary`. Sits on the white surface
below the header.

**BoardColumn** — white card, `rounded-2xl`, `shadow-sm` (→ `shadow-md` on drag-over,
already-existing `isOver` state reused). Header row keeps the column title but adds a note
count badge (neutral pill) and replaces the emoji trash button with a proper icon button
(kebab menu → rename/delete, consolidating the two existing actions into one menu). "+ Nueva
nota" becomes a ghost button with a plus icon.

**NoteCard** — keeps the post-it identity (tilt, note color, Caveat title) exactly as
approved. Only the chrome around it upgrades: shadows move to the shared elevation tokens,
the bare "×" delete becomes a small icon button (trash icon, hover-revealed, `rounded-full`
`bg-black/5`), priority becomes a colored dot + label instead of plain text, checklist
progress becomes a thin progress bar under the count instead of bare "x/y" text.

**NoteEditor** — converted from its current modal to a **right-side drawer** (slides in over
250ms, matches the Notion/Linear side-panel pattern, leaves the board visible/scrollable
behind a dim backdrop). Inputs get labels + the shared input style with turquoise focus
ring. Checklist items become proper rows with a real checkbox and hover-revealed
edit/delete. Color picker reuses the redesigned popover from BoardHeader. Delete stays
behind the existing `window.confirm` (upgrading to a custom confirm dialog component is
called out as a fast-follow, not required for this pass — see Non-Goals).

**MiniCalendarPanel** — becomes a floating card (`rounded-2xl`, `shadow-md`) instead of a
flat docked bar; its header bar uses the board's `dark` tone. Day cells become small
`rounded-[10px]` tiles with a turquoise ring on hover/drag-over. Month nav uses chevron
icons instead of `‹`/`›` text.

**CalendarView** — Mes/Semana toggle becomes the same segmented control as BoardTabs. Day
cells become proper cards with hover elevation. The existing "+N más" becomes a small pill
button. Weekday header row gets a sticky subtle bottom border.

**Shared primitives (new)** — a small set of reusable components so every screen speaks the
same visual language:
- `Button` — variants `primary` (filled turquoise) / `secondary` (neutral outline) / `ghost`
  (text-only, hover bg) / `danger` (red outline, filled on hover). States: hover, focus
  (visible ring), disabled, loading (spinner replaces label, button stays same width).
- `Input` — labeled, placeholder in `--color-text-tertiary`, focus ring turquoise, error
  state (red border + inline message below).
- `Badge` — pill, variants neutral / accent / danger.
- `Toast` — bottom-right stack, slide + fade in/out, success/danger variants. Introduced to
  replace today's silent failures (e.g. board create error currently only shows inline red
  text — stays inline **and** fires a toast for visibility).
- `EmptyState` — icon + message + primary action, used for "no boards yet" and "no notes in
  this column" (subtle, not a full illustration — a simple line icon is enough per the
  minimalism principle).

**Login/Signup** — centered card (`rounded-2xl`, `shadow-md`) on the new premium background
(very soft radial gradient in petrol/turquoise tones + near-imperceptible dot pattern, no
flat white). Card content uses the shared `Input`/`Button` primitives. Errors render as a
`--color-danger` banner instead of bare red text.

## States Checklist (per interactive flow)

Applied to: create board, add note, add column, save note, delete confirmations, sign
in/sign up.

| Flow | Hover | Focus | Loading | Empty | Error | Success |
|---|---|---|---|---|---|---|
| Create board | ✓ button | ✓ ring | ✓ spinner | "no boards yet" EmptyState | inline + toast | toast |
| Add note/column | ✓ | ✓ | n/a (optimistic) | — | toast on failure | — |
| Save note | ✓ | ✓ | n/a (optimistic) | — | toast on failure | — |
| Login/Signup | ✓ | ✓ | ✓ spinner in button | — | banner | redirect |

## Non-Goals (explicit — fast-follow candidates, not part of this pass)

- Replacing `window.confirm` dialogs with a custom Dialog/AlertDialog component.
- Dark mode (the app is intentionally light-only per earlier session decisions).
- Changing the drag-and-drop mechanics, calendar navigation logic, or any data model —
  this is a visual/CSS/markup pass over existing behavior, not a functional rewrite.
- Mobile-specific redesign beyond graceful responsive adaptation of the existing desktop-
  first layouts (per user's "Responsive: Desktop primero" instruction).

## Responsive

Desktop-first (already the case). Tablet/mobile get the same tokens and components; the
Sidebar collapses to its existing icon-only rail below a breakpoint, BoardColumn width
adapts to allow horizontal scroll (existing behavior, restyled), NoteEditor drawer becomes
full-width on mobile instead of a fixed side panel.

## Implementation Approach

1. **Tokens** — add CSS custom properties + Tailwind theme extensions (colors, radius,
   shadow, motion) in `globals.css`/Tailwind config. Update `palette.ts`'s `DEFAULT_BASE`.
2. **Shared primitives** — build `Button`, `Input`, `Badge`, `Toast`, `EmptyState` once,
   under a new `src/modules/ui/` (or similar) shared location.
3. **Apply to screens**, in an order that lets each layer build on the last: Sidebar →
   BoardHeader/BoardTabs → BoardColumn/NoteCard → NoteEditor (drawer conversion) →
   MiniCalendarPanel/CalendarView → Login/Signup → final consistency pass (spacing,
   shadows, radii, motion audit called out in the original prompt).
4. Verify each screen in the browser preview (per project convention) before moving to the
   next; deploy to production once the full pass is done and confirmed.
