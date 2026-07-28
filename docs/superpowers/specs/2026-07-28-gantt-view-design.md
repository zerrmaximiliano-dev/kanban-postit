# Gantt View — Design Spec

## Goal

Add a third view per board — **Gantt** — alongside Kanban and Calendar, showing notes with dates as time bars grouped by column, with basic dependency links between notes.

## Scope

**In scope:**
- New "Gantt" tab in `BoardTabs`, per board.
- Time bars for notes that already have `startDate` set, grouped by Kanban column.
- Zoom levels: Día / Semana / Mes.
- Drag bar body to move (shifts `startDate`+`endDate`, same duration). Drag bar edge to resize (changes only `startDate` or only `endDate`).
- Basic dependencies between notes (predecessor → successor), created by dragging from one bar's edge to another bar.
- Visual-only conflict highlight when a successor starts before its predecessor ends (no cascading auto-reschedule).
- Deleting a dependency: click the arrow, confirm via an "✕" button.
- Read-only for viewers (`canEdit === false`): no drag, no dependency creation/deletion.

**Out of scope (this plan):**
- Cycle detection/prevention for dependencies (a cycle just renders both arrows; no DB-level guard).
- Cross-board dependencies (a note can only depend on another note in the same board).
- Auto-rescheduling dependents when a predecessor moves.
- Notes without a `startDate`: hidden from the Gantt entirely (they remain visible in Kanban/Calendar as today).

## Data model

Reuses existing `notes.start_date` / `notes.end_date` — no migration needed for the bars themselves.

New table for dependencies:

```sql
create table note_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_note_id uuid not null references notes(id) on delete cascade,
  successor_note_id uuid not null references notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (predecessor_note_id, successor_note_id),
  check (predecessor_note_id <> successor_note_id)
);

alter table note_dependencies enable row level security;

create policy "Members can view dependencies" on note_dependencies
  for select using (
    is_board_member((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    ))
  );

create policy "Owners and editors manage dependencies" on note_dependencies
  for insert with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors delete dependencies" on note_dependencies
  for delete using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = note_dependencies.predecessor_note_id
    )) in ('owner', 'editor')
  );
```

No `update` policy — a link is deleted and recreated, never edited in place.

Added to the Supabase realtime publication (same as `checklist_items`) so dependency changes sync live across connected clients.

**Integrity note:** no cycle detection at the DB level. This is an accepted simplification — a cycle just renders as two arrows pointing at each other; it doesn't corrupt data or crash the UI. Revisit only if it proves to be a real problem in practice.

## Architecture

- **`GanttView.tsx`** (new, `src/modules/boards/ui/`) — mounted as the third `BoardTabs` option, same level as `BoardView.tsx`/`CalendarView.tsx`.
- Reuses `useBoardRealtime(boardId)` for `columns`/`notes` — no duplicate loading.
- New hook **`useNoteDependencies(boardId)`**, same pattern as `useBoardRealtime`: initial load + a `postgres_changes` channel on `note_dependencies`.
- Notes are filtered to those with a non-null `startDate`, grouped by `columnId` in the same order as the board's columns.
- **Timeline**: horizontal axis computed from the visible date range + active zoom level (day/week/month), with a selector styled like `CalendarView`'s existing view selector.
- **`GanttBar.tsx`** (new) — one per note; position/width computed in pixels from `startDate`/`endDate` and the active time scale.
- **Dependency arrows**: an absolutely-positioned `<svg>` overlay across the rows, one curved `<path>` per `note_dependencies` row, drawn from the predecessor bar's right edge to the successor bar's left edge.

## Interactions

- **Move bar** (drag the body): recomputes `startDate`+`endDate` preserving duration; optimistic local update, commits via the existing `updateNoteDetails` server action on drop — same pattern as the existing Kanban drag-and-drop.
- **Resize bar** (drag left/right edge): changes only `startDate` or only `endDate`, same commit-on-drop.
- **Create dependency** (drag from a bar's right edge onto another bar): on drop, inserts a row via a new server action `addDependency(predecessorId, successorId)`. No-ops if dropped outside a valid bar or if the link already exists.
- **Delete dependency**: click the arrow → a small "✕" button appears on the curve → confirming calls `removeDependency(id)`.
- **Conflict highlight**: for any note with a predecessor, if `note.startDate < predecessor.endDate`, the bar renders with a `border-danger` outline — a purely client-derived computation, nothing persisted.
- All drag/creation/deletion interactions are disabled when `canEdit` is `false` (viewer role), consistent with the existing read-only gating in `BoardView`/`CalendarView`.

## Visual style

- Zoom selector: same pill/tab styling as `CalendarView`'s month/week/day selector.
- Initial visible range: `min(startDate)` to `max(endDate)` across the board's dated notes, with a small margin on each side. No dated notes → empty state instead of an arbitrary range.
- Bar color: reuses `note.color`, same as `NoteCard` — no new Gantt-specific color scheme.
- Column group header: same visual treatment as `BoardColumn`'s column title chrome in `BoardView`.
- Tab itself: adds a third option to the existing `BoardTabs` component; no new tab-bar component.
- Overall: must read as fully consistent with the rest of the app's design system (tokens, `useBoardTheme` board color, borders/radii) — not a visually distinct sub-app.

## Empty states and error handling

- **No dated notes on the board**: centered message ("Todavía no hay notas con fechas asignadas...") styled like the existing `/boards` empty state.
- **Dependency creation fails** (e.g. network error): error toast via the existing `useToast`; the connecting line isn't drawn until the insert is confirmed.
- **Failed optimistic bar update** (drag commit fails): revert the bar to its previous position + error toast, same rollback pattern already used in `MembersPopover` (`setMembers(previous)`).

## Testing

- Vitest for pure, DOM-free logic: bar position/width calculation from dates + zoom level, conflict detection (`startDate < predecessor.endDate`), grouping-by-column.
- Real drag interactions (moving a bar, drag-to-create a dependency) are verified manually in the browser during the implementation plan — consistent with the existing Kanban drag-and-drop, which also has no unit tests for its drag behavior.

## Permissions

Same role model as the rest of the app: `owner`/`editor` can drag/move/resize bars and create/delete dependencies; `viewer` sees the Gantt read-only, gated the same way `BoardView`/`CalendarView` already gate write UI via `useBoardRole`/`canEdit`.
