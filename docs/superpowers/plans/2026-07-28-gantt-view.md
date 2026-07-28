# Gantt View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third per-board view — Gantt — showing dated notes as draggable/resizable time bars grouped by Kanban column, with drag-to-create dependency links between notes and a visual conflict highlight.

**Architecture:** Reuses the existing `useBoardRealtime` hook for columns/notes (no duplicate loading) and a new parallel `useNoteDependencies` hook for a new `note_dependencies` table, following the same load-once-then-`postgres_changes`-subscribe pattern already used throughout the app. All date math and layout math (bar position, grouping, conflict detection, timeline segments) lives in a pure, unit-tested domain module (`gantt.ts`), consistent with how `reorder.ts`/`bucketing.ts` already separate pure logic from UI. Drag interactions (move/resize a bar, drag-to-connect a dependency) use native Pointer Events directly on the bar elements rather than `dnd-kit`, since `dnd-kit`'s model doesn't fit a resize-by-edge or drag-to-a-different-element-type gesture well.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres, Realtime `postgres_changes`), Zod, Vitest. No new dependencies.

**Relationship to the spec:** Implements `docs/superpowers/specs/2026-07-28-gantt-view-design.md` in full — data model, architecture, interactions, visual style, empty/error states, testing, and permissions.

---

### Task 1: Migration — `note_dependencies` table, RLS, and realtime

**Files:**
- Create: `supabase/migrations/0013_note_dependencies.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0013_note_dependencies.sql

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

-- Same existence-check pattern as 0009_enable_realtime.sql: avoids
-- "relation is already member of publication" if replayed against a
-- project where this was added out-of-band.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_dependencies'
  ) then
    alter publication supabase_realtime add table note_dependencies;
  end if;
end $$;
```

- [ ] **Step 2: Apply the migration to the linked dev/local Supabase project**

Run: `npx supabase db push`
Expected: output lists `0013_note_dependencies.sql` as applied, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_note_dependencies.sql
git commit -m "Add note_dependencies table with RLS and realtime for the Gantt view"
```

---

### Task 2: Domain type and Zod schema for `NoteDependency`

**Files:**
- Modify: `src/modules/boards/domain/types.ts`
- Modify: `src/modules/boards/data/schemas.ts`

- [ ] **Step 1: Add the `NoteDependency` type**

In `src/modules/boards/domain/types.ts`, add at the end of the file:

```ts
export interface NoteDependency {
  id: string;
  predecessorNoteId: string;
  successorNoteId: string;
}
```

- [ ] **Step 2: Add the matching Zod schema**

In `src/modules/boards/data/schemas.ts`, add at the end of the file:

```ts
export const noteDependencyRowSchema = z.object({
  id: z.string().uuid(),
  predecessor_note_id: z.string().uuid(),
  successor_note_id: z.string().uuid(),
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/domain/types.ts src/modules/boards/data/schemas.ts
git commit -m "Add NoteDependency domain type and Zod schema"
```

---

### Task 3: `noteDependenciesRepo.ts` and `noteDependencyService.ts`

**Files:**
- Create: `src/modules/boards/data/noteDependenciesRepo.ts`
- Create: `src/modules/boards/application/noteDependencyService.ts`

- [ ] **Step 1: Write the repo**

```ts
// src/modules/boards/data/noteDependenciesRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { noteDependencyRowSchema } from './schemas';
import type { NoteDependency } from '../domain/types';

function toNoteDependency(row: unknown): NoteDependency {
  const parsed = noteDependencyRowSchema.parse(row);
  return {
    id: parsed.id,
    predecessorNoteId: parsed.predecessor_note_id,
    successorNoteId: parsed.successor_note_id,
  };
}

// Dependencies only ever connect two notes on the same board (both ends are
// always drawn from the caller's own board in the Gantt view), so filtering
// on predecessor_note_id alone is enough to scope the query to this board's
// notes — no separate board_id column needed on this table.
export async function listDependencies(client: SupabaseClient, noteIds: string[]): Promise<NoteDependency[]> {
  if (noteIds.length === 0) return [];
  const { data, error } = await client.from('note_dependencies').select('*').in('predecessor_note_id', noteIds);
  if (error) throw error;
  return data.map(toNoteDependency);
}

export async function addDependency(
  client: SupabaseClient,
  predecessorNoteId: string,
  successorNoteId: string
): Promise<NoteDependency> {
  const { data, error } = await client
    .from('note_dependencies')
    .insert({ predecessor_note_id: predecessorNoteId, successor_note_id: successorNoteId })
    .select('*')
    .single();
  if (error) throw error;
  return toNoteDependency(data);
}

export async function removeDependency(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('note_dependencies').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Write the service (thin re-export, same style as `boardService.ts`)**

```ts
// src/modules/boards/application/noteDependencyService.ts
export { listDependencies, addDependency, removeDependency } from '../data/noteDependenciesRepo';
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/data/noteDependenciesRepo.ts src/modules/boards/application/noteDependencyService.ts
git commit -m "Add noteDependenciesRepo and noteDependencyService"
```

---

### Task 4: Pure Gantt domain logic (`gantt.ts`) with tests

**Files:**
- Create: `src/modules/boards/domain/gantt.ts`
- Test: `src/modules/boards/domain/gantt.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/modules/boards/domain/gantt.test.ts
import { describe, it, expect } from 'vitest';
import {
  shiftDate,
  daysBetween,
  computeDateRange,
  computeBarLayout,
  groupDatedNotesByColumn,
  hasConflict,
  computeTimelineSegments,
} from './gantt';
import type { Column, Note, NoteDependency } from './types';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    columnId: 'col1',
    title: 'Untitled',
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    startDate: null,
    endDate: null,
    order: 0,
    checklist: [],
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column>): Column {
  return { id: 'col1', boardId: 'board1', name: 'To Do', order: 0, ...overrides };
}

describe('shiftDate', () => {
  it('adds days across a month boundary', () => {
    expect(shiftDate('2026-07-30', 3)).toBe('2026-08-02');
  });

  it('subtracts days', () => {
    expect(shiftDate('2026-07-05', -10)).toBe('2026-06-25');
  });
});

describe('daysBetween', () => {
  it('returns the number of days from one date to another', () => {
    expect(daysBetween('2026-07-01', '2026-07-05')).toBe(4);
  });

  it('returns a negative number when the second date is earlier', () => {
    expect(daysBetween('2026-07-05', '2026-07-01')).toBe(-4);
  });
});

describe('computeDateRange', () => {
  it('returns null when no notes have a startDate', () => {
    const notes = [makeNote({ startDate: null })];
    expect(computeDateRange(notes)).toBeNull();
  });

  it('spans from the earliest start to the latest end, with a margin', () => {
    const notes = [
      makeNote({ id: 'a', startDate: '2026-07-10', endDate: '2026-07-12' }),
      makeNote({ id: 'b', startDate: '2026-07-01', endDate: null }),
    ];
    const range = computeDateRange(notes);
    expect(range).toEqual({ start: '2026-06-28', end: '2026-07-15' });
  });
});

describe('computeBarLayout', () => {
  it('positions a single-day note (no endDate) at 1 day of width', () => {
    const note = makeNote({ startDate: '2026-07-05', endDate: null });
    const layout = computeBarLayout(note, '2026-07-01', 'day');
    expect(layout).toEqual({ left: 4 * 56, width: 56 });
  });

  it('returns null for a note with no startDate', () => {
    const note = makeNote({ startDate: null });
    expect(computeBarLayout(note, '2026-07-01', 'day')).toBeNull();
  });

  it('widens a multi-day note proportionally to zoom', () => {
    const note = makeNote({ startDate: '2026-07-01', endDate: '2026-07-03' });
    const layout = computeBarLayout(note, '2026-07-01', 'day');
    expect(layout).toEqual({ left: 0, width: 3 * 56 });
  });
});

describe('groupDatedNotesByColumn', () => {
  it('groups only dated notes by column, in column order', () => {
    const columns = [makeColumn({ id: 'col1', order: 0 }), makeColumn({ id: 'col2', order: 1 })];
    const notes = [
      makeNote({ id: 'a', columnId: 'col1', startDate: '2026-07-01', order: 1 }),
      makeNote({ id: 'b', columnId: 'col1', startDate: '2026-07-02', order: 0 }),
      makeNote({ id: 'c', columnId: 'col2', startDate: null }),
    ];
    const groups = groupDatedNotesByColumn(columns, notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].column.id).toBe('col1');
    expect(groups[0].notes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('hasConflict', () => {
  it('is true when a note starts before its predecessor ends', () => {
    const predecessor = makeNote({ id: 'p', startDate: '2026-07-01', endDate: '2026-07-05' });
    const successor = makeNote({ id: 's', startDate: '2026-07-03' });
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'p', successorNoteId: 's' }];
    const notesById = new Map([
      ['p', predecessor],
      ['s', successor],
    ]);
    expect(hasConflict(successor, deps, notesById)).toBe(true);
  });

  it('is false when the note starts after its predecessor ends', () => {
    const predecessor = makeNote({ id: 'p', startDate: '2026-07-01', endDate: '2026-07-05' });
    const successor = makeNote({ id: 's', startDate: '2026-07-06' });
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'p', successorNoteId: 's' }];
    const notesById = new Map([
      ['p', predecessor],
      ['s', successor],
    ]);
    expect(hasConflict(successor, deps, notesById)).toBe(false);
  });

  it('is false when the note has no dependencies', () => {
    const note = makeNote({ id: 's', startDate: '2026-07-06' });
    expect(hasConflict(note, [], new Map())).toBe(false);
  });
});

describe('computeTimelineSegments', () => {
  it('produces one segment per day at day zoom', () => {
    const segments = computeTimelineSegments('2026-07-01', '2026-07-03', 'day');
    expect(segments).toEqual([
      { label: '01', startOffsetDays: 0, widthDays: 1 },
      { label: '02', startOffsetDays: 1, widthDays: 1 },
      { label: '03', startOffsetDays: 2, widthDays: 1 },
    ]);
  });

  it('produces 7-day segments at week zoom', () => {
    const segments = computeTimelineSegments('2026-07-01', '2026-07-10', 'week');
    expect(segments).toEqual([
      { label: 'Sem 01/07', startOffsetDays: 0, widthDays: 7 },
      { label: 'Sem 08/07', startOffsetDays: 7, widthDays: 3 },
    ]);
  });

  it('splits by calendar month at month zoom', () => {
    const segments = computeTimelineSegments('2026-07-25', '2026-08-05', 'month');
    expect(segments).toEqual([
      { label: 'Jul 2026', startOffsetDays: 0, widthDays: 7 },
      { label: 'Ago 2026', startOffsetDays: 7, widthDays: 5 },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/boards/domain/gantt.test.ts`
Expected: FAIL — `./gantt` has no exported members (the module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/boards/domain/gantt.ts
import type { Column, Note, NoteDependency } from './types';

export type GanttZoom = 'day' | 'week' | 'month';

const PX_PER_DAY: Record<GanttZoom, number> = {
  day: 56,
  week: 20,
  month: 6,
};

export function pxPerDayForZoom(zoom: GanttZoom): number {
  return PX_PER_DAY[zoom];
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseDate(fromDateStr);
  const to = parseDate(toDateStr);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

const RANGE_MARGIN_DAYS = 3;

export function computeDateRange(notes: Note[]): { start: string; end: string } | null {
  const dated = notes.filter((n) => n.startDate !== null);
  if (dated.length === 0) return null;

  let minStart = dated[0].startDate as string;
  let maxEnd = dated[0].endDate ?? (dated[0].startDate as string);

  for (const note of dated) {
    const start = note.startDate as string;
    const end = note.endDate ?? start;
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  }

  return {
    start: shiftDate(minStart, -RANGE_MARGIN_DAYS),
    end: shiftDate(maxEnd, RANGE_MARGIN_DAYS),
  };
}

export interface BarLayout {
  left: number;
  width: number;
}

const MIN_BAR_WIDTH_PX = 12;

export function computeBarLayout(note: Note, rangeStart: string, zoom: GanttZoom): BarLayout | null {
  if (!note.startDate) return null;
  const pxPerDay = pxPerDayForZoom(zoom);
  const end = note.endDate ?? note.startDate;
  const left = daysBetween(rangeStart, note.startDate) * pxPerDay;
  const durationDays = daysBetween(note.startDate, end) + 1;
  const width = Math.max(durationDays * pxPerDay, MIN_BAR_WIDTH_PX);
  return { left, width };
}

export interface GanttGroup {
  column: Column;
  notes: Note[];
}

export function groupDatedNotesByColumn(columns: Column[], notes: Note[]): GanttGroup[] {
  const dated = notes.filter((n) => n.startDate !== null);
  return columns
    .map((column) => ({
      column,
      notes: dated.filter((n) => n.columnId === column.id).sort((a, b) => a.order - b.order),
    }))
    .filter((group) => group.notes.length > 0);
}

export function hasConflict(note: Note, dependencies: NoteDependency[], notesById: Map<string, Note>): boolean {
  if (!note.startDate) return false;
  const predecessorIds = dependencies
    .filter((d) => d.successorNoteId === note.id)
    .map((d) => d.predecessorNoteId);

  return predecessorIds.some((predId) => {
    const predecessor = notesById.get(predId);
    if (!predecessor?.startDate) return false;
    const predecessorEnd = predecessor.endDate ?? predecessor.startDate;
    return note.startDate! < predecessorEnd;
  });
}

export interface TimelineSegment {
  label: string;
  startOffsetDays: number;
  widthDays: number;
}

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function computeTimelineSegments(rangeStart: string, rangeEnd: string, zoom: GanttZoom): TimelineSegment[] {
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const segments: TimelineSegment[] = [];

  if (zoom === 'day') {
    for (let i = 0; i < totalDays; i++) {
      const date = shiftDate(rangeStart, i);
      segments.push({ label: date.slice(8, 10), startOffsetDays: i, widthDays: 1 });
    }
    return segments;
  }

  if (zoom === 'week') {
    let offset = 0;
    while (offset < totalDays) {
      const widthDays = Math.min(7, totalDays - offset);
      const weekStart = shiftDate(rangeStart, offset);
      segments.push({
        label: `Sem ${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`,
        startOffsetDays: offset,
        widthDays,
      });
      offset += 7;
    }
    return segments;
  }

  let offset = 0;
  while (offset < totalDays) {
    const segmentStart = shiftDate(rangeStart, offset);
    const year = Number(segmentStart.slice(0, 4));
    const month = Number(segmentStart.slice(5, 7)) - 1;
    const dayOfMonth = Number(segmentStart.slice(8, 10));
    const daysInThisMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const widthDays = Math.min(daysInThisMonth - dayOfMonth + 1, totalDays - offset);
    segments.push({ label: `${MONTH_LABELS_SHORT[month]} ${year}`, startOffsetDays: offset, widthDays });
    offset += widthDays;
  }
  return segments;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/modules/boards/domain/gantt.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/domain/gantt.ts src/modules/boards/domain/gantt.test.ts
git commit -m "Add pure Gantt domain logic: date math, bar layout, grouping, conflict detection, timeline segments"
```

---

### Task 5: `useNoteDependencies` hook

**Files:**
- Create: `src/modules/boards/ui/useNoteDependencies.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/modules/boards/ui/useNoteDependencies.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { listDependencies } from '../application/noteDependencyService';
import { noteDependencyRowSchema } from '../data/schemas';
import type { NoteDependency } from '../domain/types';

type Row = Record<string, unknown>;

function fromRow(row: Row): NoteDependency {
  const parsed = noteDependencyRowSchema.parse(row);
  return {
    id: parsed.id,
    predecessorNoteId: parsed.predecessor_note_id,
    successorNoteId: parsed.successor_note_id,
  };
}

export function useNoteDependencies(boardId: string, noteIds: string[]) {
  const [dependencies, setDependencies] = useState<NoteDependency[]>([]);
  const noteIdsRef = useRef<Set<string>>(new Set());
  const noteIdsKey = noteIds.join(',');

  useEffect(() => {
    noteIdsRef.current = new Set(noteIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey]);

  useEffect(() => {
    if (noteIds.length === 0) {
      setDependencies([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    listDependencies(supabase, noteIds).then((deps) => {
      if (!cancelled) setDependencies(deps);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`note-dependencies:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_dependencies' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId) return;
            setDependencies((prev) => prev.filter((d) => d.id !== oldId));
            return;
          }
          const row = payload.new as Row;
          const predecessorId = row.predecessor_note_id as string;
          if (!noteIdsRef.current.has(predecessorId)) return;
          const dep = fromRow(row);
          setDependencies((prev) => (prev.some((d) => d.id === dep.id) ? prev : [...prev, dep]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return { dependencies, setDependencies };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/useNoteDependencies.ts
git commit -m "Add useNoteDependencies: loads and syncs note_dependencies for a board's dated notes"
```

---

### Task 6: `useDependencyArrows` hook (DOM-measured arrow positions)

**Files:**
- Create: `src/modules/boards/ui/useDependencyArrows.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/modules/boards/ui/useDependencyArrows.ts
'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { NoteDependency } from '../domain/types';

export interface DependencyArrow {
  id: string;
  d: string;
  midX: number;
  midY: number;
}

// Row positions depend on rendered DOM layout (group headers, row height,
// scroll position) rather than something computable in pure domain logic,
// so arrows are measured directly off the bar elements via
// getBoundingClientRect, the same way real Gantt/diagram libraries do this.
// Recomputing on every render (no dependency array on the effect below) is
// an accepted simplification for the expected board sizes — revisit only if
// it proves to be a real perf problem in practice.
export function useDependencyArrows(
  containerRef: RefObject<HTMLDivElement | null>,
  dependencies: NoteDependency[]
): DependencyArrow[] {
  const [arrows, setArrows] = useState<DependencyArrow[]>([]);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const next: DependencyArrow[] = [];
      for (const dep of dependencies) {
        const fromEl = container.querySelector<HTMLElement>(`[data-note-id="${dep.predecessorNoteId}"]`);
        const toEl = container.querySelector<HTMLElement>(`[data-note-id="${dep.successorNoteId}"]`);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const x1 = fromRect.right - containerRect.left + container.scrollLeft;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + container.scrollTop;
        const x2 = toRect.left - containerRect.left + container.scrollLeft;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top + container.scrollTop;
        const midX = (x1 + x2) / 2;

        next.push({
          id: dep.id,
          d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
          midX,
          midY: (y1 + y2) / 2,
        });
      }
      setArrows(next);
    }

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  });

  return arrows;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/useDependencyArrows.ts
git commit -m "Add useDependencyArrows: measures bar DOM positions to draw dependency curves"
```

---

### Task 7: `GanttBar` component (move/resize/connect via Pointer Events)

**Files:**
- Create: `src/modules/boards/ui/GanttBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/modules/boards/ui/GanttBar.tsx
'use client';

import { useRef } from 'react';
import type { Note } from '../domain/types';
import { shiftDate, pxPerDayForZoom, type GanttZoom } from '../domain/gantt';

const BAR_HEIGHT = 20;
const ROW_HEIGHT = 36;

export function GanttBar({
  note,
  left,
  width,
  conflict,
  canEdit,
  zoom,
  onCommitDates,
  onStartConnect,
  onOpen,
}: {
  note: Note;
  left: number;
  width: number;
  conflict: boolean;
  canEdit: boolean;
  zoom: GanttZoom;
  onCommitDates: (noteId: string, startDate: string, endDate: string) => void;
  onStartConnect: (noteId: string) => void;
  onOpen: (note: Note) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originWidth: number;
  } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize-start' | 'resize-end') {
    if (!canEdit) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { mode, startX: e.clientX, originWidth: width };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    const el = barRef.current;
    if (!state || !el) return;
    const dx = e.clientX - state.startX;
    if (state.mode === 'move') {
      el.style.transform = `translateX(${dx}px)`;
    } else if (state.mode === 'resize-end') {
      el.style.width = `${Math.max(state.originWidth + dx, 12)}px`;
    } else {
      el.style.transform = `translateX(${dx}px)`;
      el.style.width = `${Math.max(state.originWidth - dx, 12)}px`;
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    dragState.current = null;
    const el = barRef.current;
    if (!state || !el || !note.startDate) return;

    const dx = e.clientX - state.startX;
    const pxPerDay = pxPerDayForZoom(zoom);
    const dayDelta = Math.round(dx / pxPerDay);
    el.style.transform = '';
    el.style.width = `${width}px`;

    if (dayDelta === 0) return;

    const currentEnd = note.endDate ?? note.startDate;
    if (state.mode === 'move') {
      onCommitDates(note.id, shiftDate(note.startDate, dayDelta), shiftDate(currentEnd, dayDelta));
    } else if (state.mode === 'resize-end') {
      const newEnd = shiftDate(currentEnd, dayDelta);
      if (newEnd < note.startDate) return;
      onCommitDates(note.id, note.startDate, newEnd);
    } else {
      const newStart = shiftDate(note.startDate, dayDelta);
      if (newStart > currentEnd) return;
      onCommitDates(note.id, newStart, currentEnd);
    }
  }

  return (
    <div
      ref={barRef}
      data-note-id={note.id}
      onDoubleClick={() => onOpen(note)}
      style={{
        position: 'absolute',
        left,
        width,
        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
        height: BAR_HEIGHT,
        backgroundColor: note.color,
      }}
      className={`group rounded-[5px] shadow-elevation-sm ${conflict ? 'border-2 border-danger' : ''}`}
      title={note.title}
    >
      {canEdit && (
        <>
          <div
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          />
          <div
            onPointerDown={(e) => handlePointerDown(e, 'resize-start')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(e) => handlePointerDown(e, 'resize-end')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(note.id);
            }}
            className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-accent-500 opacity-0 shadow-elevation-sm group-hover:opacity-100"
            title="Arrastrar hasta otra nota para crear una dependencia"
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/GanttBar.tsx
git commit -m "Add GanttBar: drag-to-move, drag-edge-to-resize, drag-to-connect handle"
```

---

### Task 8: `GanttView` component

**Files:**
- Create: `src/modules/boards/ui/GanttView.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/modules/boards/ui/GanttView.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import {
  addChecklistItem,
  deleteChecklistItem,
  deleteNote,
  updateChecklistItem,
  updateNoteDetails,
} from '../application/noteService';
import { addDependency, removeDependency } from '../application/noteDependencyService';
import { useBoardRealtime } from './useBoardRealtime';
import { useBoardRole } from './useBoardRole';
import { useNoteDependencies } from './useNoteDependencies';
import { useDependencyArrows } from './useDependencyArrows';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import { BoardHeader } from './BoardHeader';
import { BoardTabs } from './BoardTabs';
import { GanttBar } from './GanttBar';
import { NoteEditor } from './NoteEditor';
import { useToast } from '@/src/modules/ui/Toast';
import {
  computeBarLayout,
  computeDateRange,
  computeTimelineSegments,
  groupDatedNotesByColumn,
  hasConflict,
  pxPerDayForZoom,
  type GanttZoom,
} from '../domain/gantt';
import type { ChecklistItem, Note } from '../domain/types';

const ROW_HEIGHT = 36;
const LABEL_COLUMN_WIDTH = 176;
const ZOOM_LABEL: Record<GanttZoom, string> = { day: 'Día', week: 'Semana', month: 'Mes' };

export function GanttView({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const { boardColor } = useBoardTheme();
  const palette = getBoardPalette(boardColor);
  const { showToast } = useToast();
  const { columns, notes, setNotes } = useBoardRealtime(boardId);
  const { canEdit } = useBoardRole(boardId);
  const [zoom, setZoom] = useState<GanttZoom>('week');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [selectedDependencyId, setSelectedDependencyId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => groupDatedNotesByColumn(columns, notes), [columns, notes]);
  const datedNotes = useMemo(() => groups.flatMap((g) => g.notes), [groups]);
  const noteIds = useMemo(() => datedNotes.map((n) => n.id), [datedNotes]);
  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  const { dependencies, setDependencies } = useNoteDependencies(boardId, noteIds);
  const arrows = useDependencyArrows(containerRef, dependencies);

  const range = useMemo(() => computeDateRange(datedNotes), [datedNotes]);
  const pxPerDay = pxPerDayForZoom(zoom);
  const segments = range ? computeTimelineSegments(range.start, range.end, zoom) : [];
  const totalWidth =
    LABEL_COLUMN_WIDTH + segments.reduce((sum, seg) => sum + seg.widthDays * pxPerDay, 0);

  useEffect(() => {
    if (!connectingFrom) return;
    function handleWindowPointerUp(e: PointerEvent) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const targetNoteId = el?.closest<HTMLElement>('[data-note-id]')?.dataset.noteId;
      setConnectingFrom(null);
      if (targetNoteId) {
        handleCreateDependency(connectingFrom!, targetNoteId);
      }
    }
    window.addEventListener('pointerup', handleWindowPointerUp, { once: true });
    return () => window.removeEventListener('pointerup', handleWindowPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectingFrom]);

  async function commitDates(noteId: string, startDate: string, endDate: string) {
    const previous = notes;
    setNotes(notes.map((n) => (n.id === noteId ? { ...n, startDate, endDate } : n)));
    try {
      await updateNoteDetails(supabase, noteId, { startDate, endDate });
    } catch {
      setNotes(previous);
      showToast('No se pudo actualizar la fecha', 'danger');
    }
  }

  async function handleCreateDependency(predecessorNoteId: string, successorNoteId: string) {
    if (predecessorNoteId === successorNoteId) return;
    const alreadyExists = dependencies.some(
      (d) => d.predecessorNoteId === predecessorNoteId && d.successorNoteId === successorNoteId
    );
    if (alreadyExists) return;
    try {
      const dep = await addDependency(supabase, predecessorNoteId, successorNoteId);
      setDependencies((prev) => [...prev, dep]);
    } catch {
      showToast('No se pudo crear la dependencia', 'danger');
    }
  }

  async function handleRemoveDependency(id: string) {
    const previous = dependencies;
    setDependencies((prev) => prev.filter((d) => d.id !== id));
    setSelectedDependencyId(null);
    try {
      await removeDependency(supabase, id);
    } catch {
      setDependencies(previous);
      showToast('No se pudo eliminar la dependencia', 'danger');
    }
  }

  async function handleSaveNote(update: Parameters<typeof updateNoteDetails>[2]) {
    if (!activeNote) return;
    await updateNoteDetails(supabase, activeNote.id, update);
    setNotes(notes.map((n) => (n.id === activeNote.id ? { ...n, ...update } : n)));
  }

  async function handleDeleteNote(note: Note) {
    setNotes(notes.filter((n) => n.id !== note.id));
    await deleteNote(supabase, note.id);
  }

  async function handleAddChecklistItem(text: string): Promise<ChecklistItem> {
    if (!activeNote) throw new Error('No active note');
    const order = activeNote.checklist.length;
    const item = await addChecklistItem(supabase, activeNote.id, text, order);
    setNotes(notes.map((n) => (n.id === activeNote.id ? { ...n, checklist: [...n.checklist, item] } : n)));
    return item;
  }

  function handleToggleChecklistItem(item: ChecklistItem, done: boolean) {
    if (!activeNote) return;
    setNotes(
      notes.map((n) =>
        n.id === activeNote.id
          ? { ...n, checklist: n.checklist.map((i) => (i.id === item.id ? { ...i, done } : i)) }
          : n
      )
    );
    updateChecklistItem(supabase, item.id, { done });
  }

  function handleEditChecklistItemText(item: ChecklistItem, text: string) {
    if (!activeNote) return;
    setNotes(
      notes.map((n) =>
        n.id === activeNote.id
          ? { ...n, checklist: n.checklist.map((i) => (i.id === item.id ? { ...i, text } : i)) }
          : n
      )
    );
    updateChecklistItem(supabase, item.id, { text });
  }

  function handleDeleteChecklistItem(item: ChecklistItem) {
    if (!activeNote) return;
    setNotes(
      notes.map((n) =>
        n.id === activeNote.id ? { ...n, checklist: n.checklist.filter((i) => i.id !== item.id) } : n
      )
    );
    deleteChecklistItem(supabase, item.id);
  }

  const selectedArrow = arrows.find((a) => a.id === selectedDependencyId);

  return (
    <div className="flex h-full flex-col">
      <BoardHeader boardId={boardId} />
      <BoardTabs boardId={boardId} />
      <div className="flex flex-1 flex-col overflow-hidden p-4" style={{ backgroundColor: palette.light }}>
        <div className="mb-4 flex shrink-0 gap-4 border-b border-border">
          {(['day', 'week', 'month'] as const).map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={`border-b-2 py-2 text-sm font-medium transition-colors duration-150 ease-standard ${
                zoom === z ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {ZOOM_LABEL[z]}
            </button>
          ))}
        </div>

        {!range ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="max-w-sm text-center text-sm text-ink-muted">
              Todavía no hay notas con fechas asignadas. Agregá una fecha de inicio desde una nota para verla acá.
            </p>
          </div>
        ) : (
          <div
            ref={containerRef}
            onClick={() => setSelectedDependencyId(null)}
            className="relative flex-1 overflow-auto rounded-card border border-border bg-surface"
          >
            <div style={{ position: 'relative', width: totalWidth }}>
              <div className="sticky top-0 z-10 flex border-b border-border bg-page">
                <div style={{ width: LABEL_COLUMN_WIDTH }} className="shrink-0 border-r border-border" />
                {segments.map((seg) => (
                  <div
                    key={seg.startOffsetDays}
                    style={{ width: seg.widthDays * pxPerDay }}
                    className="shrink-0 border-r border-border px-2 py-2 text-center text-xs font-medium text-ink-muted"
                  >
                    {seg.label}
                  </div>
                ))}
              </div>

              {groups.map((group) => (
                <div key={group.column.id}>
                  <div className="border-b border-border bg-page px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {group.column.name}
                  </div>
                  {group.notes.map((note) => {
                    const layout = computeBarLayout(note, range.start, zoom);
                    if (!layout) return null;
                    const conflict = hasConflict(note, dependencies, notesById);
                    return (
                      <div
                        key={note.id}
                        className="flex border-b border-border/60"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <div
                          style={{ width: LABEL_COLUMN_WIDTH }}
                          className="shrink-0 truncate border-r border-border px-3 py-2 text-sm text-ink"
                        >
                          {note.title}
                        </div>
                        <div className="relative flex-1">
                          <GanttBar
                            note={note}
                            left={layout.left}
                            width={layout.width}
                            conflict={conflict}
                            canEdit={canEdit}
                            zoom={zoom}
                            onCommitDates={commitDates}
                            onStartConnect={setConnectingFrom}
                            onOpen={setActiveNote}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              <svg className="pointer-events-none absolute inset-0 h-full w-full">
                {arrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrow.d}
                    stroke={selectedDependencyId === arrow.id ? '#ef4444' : '#94a3b8'}
                    strokeWidth={selectedDependencyId === arrow.id ? 2.5 : 1.5}
                    fill="none"
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDependencyId((cur) => (cur === arrow.id ? null : arrow.id));
                    }}
                  />
                ))}
              </svg>

              {selectedArrow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveDependency(selectedArrow.id);
                  }}
                  style={{ position: 'absolute', left: selectedArrow.midX - 10, top: selectedArrow.midY - 10 }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs text-white shadow-elevation-md"
                  aria-label="Eliminar dependencia"
                  title="Eliminar dependencia"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {activeNote && (
        <NoteEditor
          note={activeNote}
          onClose={() => setActiveNote(null)}
          onSave={handleSaveNote}
          onDelete={() => handleDeleteNote(activeNote)}
          onAddChecklistItem={handleAddChecklistItem}
          onToggleChecklistItem={handleToggleChecklistItem}
          onEditChecklistItemText={handleEditChecklistItemText}
          onDeleteChecklistItem={handleDeleteChecklistItem}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/GanttView.tsx
git commit -m "Add GanttView: timeline header, grouped bars, dependency arrows, zoom selector"
```

---

### Task 9: Route and `BoardTabs` wiring

**Files:**
- Create: `app/(app)/boards/[boardId]/gantt/page.tsx`
- Modify: `src/modules/boards/ui/BoardTabs.tsx`

- [ ] **Step 1: Write the route**

```tsx
// app/(app)/boards/[boardId]/gantt/page.tsx
import { GanttView } from '@/src/modules/boards/ui/GanttView';

export default async function GanttPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <GanttView boardId={boardId} />;
}
```

- [ ] **Step 2: Add the third tab**

Replace the full contents of `src/modules/boards/ui/BoardTabs.tsx` with:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BoardTabs({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname?.endsWith('/calendar');
  const isGantt = pathname?.endsWith('/gantt');
  const isBoard = !isCalendar && !isGantt;

  return (
    <div className="flex gap-6 border-b border-border bg-surface px-6">
      <Link
        href={`/boards/${boardId}`}
        aria-current={isBoard ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isBoard ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Board
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        aria-current={isCalendar ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isCalendar ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Calendario
      </Link>
      <Link
        href={`/boards/${boardId}/gantt`}
        aria-current={isGantt ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isGantt ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Gantt
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass (13 existing + 17 new from Task 4 = 30).

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/boards/[boardId]/gantt/page.tsx" src/modules/boards/ui/BoardTabs.tsx
git commit -m "Add /boards/[boardId]/gantt route and wire the Gantt tab into BoardTabs"
```

---

### Task 10: Manual verification

This task has no automated test — drag interactions and cross-browser realtime timing aren't practical to exercise in Vitest. Do this manually against the dev Supabase project before merging.

**Files:** none (verification only).

- [ ] **Step 1: Basic rendering**

Run the dev server, open a board with at least 3 notes across 2+ columns, and give 2 of them a `startDate` (edit them via the existing NoteEditor). Open the new "Gantt" tab.
Expected: notes with a date appear as colored bars, grouped under their column's header; notes without a date do not appear; the tab visually matches the app's existing tokens (borders, surface color, board theme color).

- [ ] **Step 2: Zoom**

Click Día / Semana / Mes.
Expected: the timeline header re-renders at each granularity (day numbers / week labels / month labels) and bar widths scale accordingly without the layout breaking.

- [ ] **Step 3: Move and resize a bar**

Drag the body of a bar to a new position; drag its left and right edges.
Expected: after releasing, the note's `startDate`/`endDate` are updated (refresh the NoteEditor for that note to confirm), and the bar stays in its new position (no flicker back to the old spot).

- [ ] **Step 4: Create and delete a dependency**

Drag from one bar's small connect handle (hover the right edge to reveal it) onto another bar. Then click the resulting curved line and confirm the ✕ button removes it.
Expected: the curve appears after connecting, persists after a page refresh, and disappears after clicking ✕.

- [ ] **Step 5: Conflict highlight**

With a dependency A → B in place, drag B so it starts before A ends.
Expected: B's bar gets a red border. Moving B back to start after A ends removes the red border.

- [ ] **Step 6: Viewer read-only**

As a board member with the "Solo lectura" role (set via the Members popover), open the Gantt tab.
Expected: bars render but have no drag handles or connect handle, and dragging does nothing.

- [ ] **Step 7: Empty state**

Open the Gantt tab on a board where no note has a `startDate`.
Expected: the "Todavía no hay notas con fechas asignadas..." message shows instead of a timeline.

- [ ] **Step 8: Record the result**

If all seven checks pass, proceed to Task 11. If any fails, fix the underlying code before continuing.

---

### Task 11: Final verification and deploy

**Files:** none (verification and deploy only).

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Confirm the migration is applied to production Supabase**

Run: `npx supabase db push --linked` (or the project's existing production migration command)
Expected: `0013_note_dependencies.sql` shows as applied with no errors.

- [ ] **Step 4: Commit and push**

```bash
git push origin master
```

Expected: Vercel picks up the push and deploys; confirm with `npx vercel ls kanban-postit --yes` that the new deployment reaches `Ready`.

- [ ] **Step 5: Smoke-test in production**

Repeat Task 10's Steps 1, 3, and 4 (basic rendering, move/resize, create/delete dependency) against the production URL, since Supabase Realtime and drag/pointer behavior can differ between local/dev and the deployed environment.
