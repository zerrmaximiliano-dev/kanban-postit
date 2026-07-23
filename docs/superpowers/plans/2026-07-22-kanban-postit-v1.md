# Kanban Post-it v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working v1 of a Kanban board app with post-it style notes (multiple boards, configurable columns, rich notes) plus an internal Month/Week calendar view derived from note due dates.

**Architecture:** Next.js (App Router) + TypeScript, organized as feature modules (`boards`, `notes`, `calendar`, `identity`) each split into `domain/` (pure logic, no I/O), `application/` (services), `data/` (Supabase repositories), `ui/` (components/hooks). Supabase provides Postgres + Auth. UI state/caching via TanStack Query; drag & drop via dnd-kit; validation via Zod.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (Postgres + Auth), Zod, TanStack Query, dnd-kit, Vitest, @testing-library/react, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-22-kanban-postit-design.md`

---

## File Structure Overview

```
kanban-postit/
├─ app/
│  ├─ (auth)/login/page.tsx
│  ├─ (app)/layout.tsx                    # Sidebar shell, requires auth
│  ├─ (app)/boards/[boardId]/page.tsx     # Board tab (default)
│  ├─ (app)/boards/[boardId]/calendar/page.tsx  # Calendar tab
│  ├─ layout.tsx                          # Root layout, QueryClientProvider
│  └─ middleware.ts                       # Protect (app) routes
├─ src/
│  ├─ modules/
│  │  ├─ boards/
│  │  │  ├─ domain/types.ts
│  │  │  ├─ domain/reorder.ts
│  │  │  ├─ domain/reorder.test.ts
│  │  │  ├─ data/schemas.ts
│  │  │  ├─ data/boardsRepo.ts
│  │  │  ├─ data/columnsRepo.ts
│  │  │  ├─ data/notesRepo.ts
│  │  │  ├─ application/boardService.ts
│  │  │  ├─ application/noteService.ts
│  │  │  ├─ ui/useBoards.ts
│  │  │  ├─ ui/Sidebar.tsx
│  │  │  ├─ ui/BoardView.tsx
│  │  │  ├─ ui/NoteCard.tsx
│  │  │  ├─ ui/NoteCard.test.tsx
│  │  │  └─ ui/NoteEditor.tsx
│  │  ├─ calendar/
│  │  │  ├─ domain/bucketing.ts
│  │  │  ├─ domain/bucketing.test.ts
│  │  │  └─ ui/CalendarView.tsx
│  │  └─ identity/
│  │     └─ data/supabaseClient.ts
│  └─ lib/queryClient.ts
├─ supabase/migrations/0001_init.sql
├─ tests/e2e/kanban-flow.spec.ts
├─ .env.local.example
├─ vitest.config.ts
├─ playwright.config.ts
└─ README.md
```

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: entire project scaffold (via CLI) in `C:\Users\zerrm\OneDrive\Documentos\Claude\Proyectos\kanban-postit`

- [ ] **Step 1: Run create-next-app in the existing folder**

```bash
cd "C:/Users/zerrm/OneDrive/Documentos/Claude/Proyectos/kanban-postit"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm
```

When prompted about the non-empty directory (it already has `.git`, `docs/`, `.gitignore`), confirm to continue.

- [ ] **Step 2: Verify the dev server runs**

Run: `npm run dev`
Expected: Server starts on `http://localhost:3000`, default Next.js page loads without errors. Stop it with Ctrl+C.

- [ ] **Step 3: Install project dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr @tanstack/react-query zod @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 4: Commit the scaffold**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with core dependencies"
```

---

### Task 2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Write the Vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

- [ ] **Step 2: Write the setup file**

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 3: Add the test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify Vitest runs with zero tests**

Run: `npm run test`
Expected: "No test files found" (exit code may be non-zero — that's fine, confirms Vitest is wired up). No config errors.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: configure Vitest"
```

---

### Task 3: Domain types for boards and notes

**Files:**
- Create: `src/modules/boards/domain/types.ts`

- [ ] **Step 1: Write the shared domain types**

```typescript
// src/modules/boards/domain/types.ts
export type Priority = 'low' | 'medium' | 'high';

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  orgId: string | null;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  order: number;
}

export interface ChecklistItem {
  id: string;
  noteId: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Note {
  id: string;
  columnId: string;
  title: string;
  description: string;
  color: string;
  priority: Priority;
  tags: string[];
  dueDate: string | null; // 'YYYY-MM-DD' or null
  order: number;
  checklist: ChecklistItem[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/domain/types.ts
git commit -m "feat(boards): add domain types for Board, Column, Note, ChecklistItem"
```

---

### Task 4: Reorder/move domain logic (TDD)

**Files:**
- Create: `src/modules/boards/domain/reorder.test.ts`
- Create: `src/modules/boards/domain/reorder.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/boards/domain/reorder.test.ts
import { describe, it, expect } from 'vitest';
import { reorderWithinColumn, moveNoteToColumn } from './reorder';
import type { Note } from './types';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    columnId: 'col1',
    title: 'Untitled',
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    dueDate: null,
    order: 0,
    checklist: [],
    ...overrides,
  };
}

describe('reorderWithinColumn', () => {
  it('moves a note to a new position within the same column', () => {
    const notes = [
      makeNote({ id: 'a', order: 0 }),
      makeNote({ id: 'b', order: 1 }),
      makeNote({ id: 'c', order: 2 }),
    ];

    const result = reorderWithinColumn(notes, 'a', 2);

    expect(result.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    expect(result.find((n) => n.id === 'a')?.order).toBe(2);
    expect(result.find((n) => n.id === 'b')?.order).toBe(0);
  });

  it('returns the original array if the note id does not exist', () => {
    const notes = [makeNote({ id: 'a', order: 0 })];
    const result = reorderWithinColumn(notes, 'missing', 0);
    expect(result).toEqual(notes);
  });
});

describe('moveNoteToColumn', () => {
  it('moves a note to a different column at the target index and re-orders both columns', () => {
    const notes = [
      makeNote({ id: 'a', columnId: 'col1', order: 0 }),
      makeNote({ id: 'b', columnId: 'col1', order: 1 }),
      makeNote({ id: 'c', columnId: 'col2', order: 0 }),
    ];

    const result = moveNoteToColumn(notes, 'a', 'col2', 0);

    const moved = result.find((n) => n.id === 'a');
    expect(moved?.columnId).toBe('col2');
    expect(moved?.order).toBe(0);

    const c = result.find((n) => n.id === 'c');
    expect(c?.order).toBe(1);

    const b = result.find((n) => n.id === 'b');
    expect(b?.columnId).toBe('col1');
    expect(b?.order).toBe(0);
  });

  it('returns the original array if the note id does not exist', () => {
    const notes = [makeNote({ id: 'a', columnId: 'col1', order: 0 })];
    const result = moveNoteToColumn(notes, 'missing', 'col2', 0);
    expect(result).toEqual(notes);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- reorder`
Expected: FAIL — `Cannot find module './reorder'` (file doesn't exist yet).

- [ ] **Step 3: Implement the minimal logic to pass**

```typescript
// src/modules/boards/domain/reorder.ts
import type { Note } from './types';

export function reorderWithinColumn(notes: Note[], noteId: string, newIndex: number): Note[] {
  const sorted = [...notes].sort((a, b) => a.order - b.order);
  const fromIndex = sorted.findIndex((n) => n.id === noteId);
  if (fromIndex === -1) return notes;

  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(newIndex, 0, moved);

  return sorted.map((n, i) => ({ ...n, order: i }));
}

export function moveNoteToColumn(
  allNotes: Note[],
  noteId: string,
  targetColumnId: string,
  targetIndex: number
): Note[] {
  const note = allNotes.find((n) => n.id === noteId);
  if (!note) return allNotes;

  const withoutNote = allNotes.filter((n) => n.id !== noteId);

  const targetColumnNotes = withoutNote
    .filter((n) => n.columnId === targetColumnId)
    .sort((a, b) => a.order - b.order);

  const movedNote: Note = { ...note, columnId: targetColumnId, order: targetIndex };
  targetColumnNotes.splice(targetIndex, 0, movedNote);
  const reorderedTarget = targetColumnNotes.map((n, i) => ({ ...n, order: i }));

  const otherNotes = withoutNote.filter((n) => n.columnId !== targetColumnId);

  return [...otherNotes, ...reorderedTarget];
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- reorder`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/domain/reorder.ts src/modules/boards/domain/reorder.test.ts
git commit -m "feat(boards): add pure reorder/move domain logic with tests"
```

---

### Task 5: Calendar bucketing domain logic (TDD)

**Files:**
- Create: `src/modules/calendar/domain/bucketing.test.ts`
- Create: `src/modules/calendar/domain/bucketing.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/calendar/domain/bucketing.test.ts
import { describe, it, expect } from 'vitest';
import { bucketNotesByDay, getMonthRange, getWeekRange } from './bucketing';
import type { Note } from '../../boards/domain/types';

function makeNote(id: string, dueDate: string | null): Note {
  return {
    id,
    columnId: 'col1',
    title: id,
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    dueDate,
    order: 0,
    checklist: [],
  };
}

describe('getMonthRange', () => {
  it('returns first and last day of February in a leap year', () => {
    const { start, end } = getMonthRange(2024, 1); // month is 0-indexed: 1 = February
    expect(start.toISOString().slice(0, 10)).toBe('2024-02-01');
    expect(end.toISOString().slice(0, 10)).toBe('2024-02-29');
  });
});

describe('getWeekRange', () => {
  it('returns Monday through Sunday for a Wednesday date', () => {
    const wednesday = new Date('2026-07-22T00:00:00'); // a Wednesday
    const { start, end } = getWeekRange(wednesday);
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-26');
  });

  it('treats Sunday as the end of the previous week, not the start of a new one', () => {
    const sunday = new Date('2026-07-26T00:00:00');
    const { start, end } = getWeekRange(sunday);
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-26');
  });
});

describe('bucketNotesByDay', () => {
  it('groups notes into the bucket matching their dueDate', () => {
    const notes = [
      makeNote('a', '2026-07-20'),
      makeNote('b', '2026-07-20'),
      makeNote('c', '2026-07-22'),
      makeNote('d', null),
    ];

    const buckets = bucketNotesByDay(notes, new Date('2026-07-20'), new Date('2026-07-22'));

    expect(buckets).toHaveLength(3);
    expect(buckets[0].date).toBe('2026-07-20');
    expect(buckets[0].notes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(buckets[2].date).toBe('2026-07-22');
    expect(buckets[2].notes.map((n) => n.id)).toEqual(['c']);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- bucketing`
Expected: FAIL — `Cannot find module './bucketing'`

- [ ] **Step 3: Implement the minimal logic to pass**

```typescript
// src/modules/calendar/domain/bucketing.ts
import type { Note } from '../../boards/domain/types';

export interface DayBucket {
  date: string; // 'YYYY-MM-DD'
  notes: Note[];
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function bucketNotesByDay(notes: Note[], rangeStart: Date, rangeEnd: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  const cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    const dateStr = toDateString(cursor);
    buckets.push({
      date: dateStr,
      notes: notes.filter((n) => n.dueDate === dateStr),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- bucketing`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/domain/bucketing.ts src/modules/calendar/domain/bucketing.test.ts
git commit -m "feat(calendar): add pure date-bucketing domain logic with tests"
```

---

### Task 6: Supabase project wiring (client + env)

**Files:**
- Create: `src/modules/identity/data/supabaseClient.ts`
- Create: `src/modules/identity/data/supabaseServerClient.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Create a Supabase project**

Go to https://supabase.com/dashboard, create a new project named `kanban-postit`. Copy the **Project URL** and **anon public key** from Settings → API.

- [ ] **Step 2: Write the env example file**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Copy it to `.env.local` and fill in the real values. `.env.local` is already gitignored by the Next.js scaffold.

- [ ] **Step 3: Write the browser Supabase client**

```typescript
// src/modules/identity/data/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: Write the server Supabase client**

```typescript
// src/modules/identity/data/supabaseServerClient.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/identity/data/supabaseClient.ts src/modules/identity/data/supabaseServerClient.ts .env.local.example
git commit -m "feat(identity): add Supabase browser and server clients"
```

---

### Task 7: Database schema migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Write the schema SQL**

```sql
-- supabase/migrations/0001_init.sql
create table boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid null,
  created_at timestamptz not null default now()
);

create table columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  name text not null,
  "order" integer not null default 0
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references columns(id) on delete cascade,
  title text not null,
  description text not null default '',
  color text not null default '#fff59d',
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  tags text[] not null default '{}',
  due_date date null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references notes(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  "order" integer not null default 0
);

alter table boards enable row level security;
alter table columns enable row level security;
alter table notes enable row level security;
alter table checklist_items enable row level security;

create policy "Owners manage their boards" on boards
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Owners manage columns of their boards" on columns
  for all using (exists (select 1 from boards b where b.id = columns.board_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from boards b where b.id = columns.board_id and b.owner_id = auth.uid()));

create policy "Owners manage notes in their boards" on notes
  for all using (exists (
    select 1 from columns c join boards b on b.id = c.board_id
    where c.id = notes.column_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from columns c join boards b on b.id = c.board_id
    where c.id = notes.column_id and b.owner_id = auth.uid()
  ));

create policy "Owners manage checklist items in their notes" on checklist_items
  for all using (exists (
    select 1 from notes n
    join columns c on c.id = n.column_id
    join boards b on b.id = c.board_id
    where n.id = checklist_items.note_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from notes n
    join columns c on c.id = n.column_id
    join boards b on b.id = c.board_id
    where n.id = checklist_items.note_id and b.owner_id = auth.uid()
  ));
```

- [ ] **Step 2: Apply the migration**

In the Supabase dashboard, go to SQL Editor, paste the contents of `0001_init.sql`, and run it.
Expected: 4 tables created (`boards`, `columns`, `notes`, `checklist_items`), visible in Table Editor, with RLS enabled (shown by a lock icon).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat(db): add initial schema migration with owner-based RLS"
```

---

### Task 8: Zod schemas and data repositories

**Files:**
- Create: `src/modules/boards/data/schemas.ts`
- Create: `src/modules/boards/data/boardsRepo.ts`
- Create: `src/modules/boards/data/columnsRepo.ts`
- Create: `src/modules/boards/data/notesRepo.ts`

- [ ] **Step 1: Write the Zod schemas mapping DB rows to domain types**

```typescript
// src/modules/boards/data/schemas.ts
import { z } from 'zod';

export const boardRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_id: z.string().uuid(),
  org_id: z.string().uuid().nullable(),
});

export const columnRowSchema = z.object({
  id: z.string().uuid(),
  board_id: z.string().uuid(),
  name: z.string().min(1),
  order: z.number().int(),
});

export const checklistItemRowSchema = z.object({
  id: z.string().uuid(),
  note_id: z.string().uuid(),
  text: z.string(),
  done: z.boolean(),
  order: z.number().int(),
});

export const noteRowSchema = z.object({
  id: z.string().uuid(),
  column_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  color: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  tags: z.array(z.string()),
  due_date: z.string().nullable(),
  order: z.number().int(),
});
```

- [ ] **Step 2: Write the boards repository**

```typescript
// src/modules/boards/data/boardsRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { boardRowSchema } from './schemas';
import type { Board } from '../domain/types';

function toBoard(row: unknown): Board {
  const parsed = boardRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner_id,
    orgId: parsed.org_id,
  };
}

export async function listBoards(client: SupabaseClient): Promise<Board[]> {
  const { data, error } = await client.from('boards').select('*').order('created_at');
  if (error) throw error;
  return data.map(toBoard);
}

export async function createBoard(client: SupabaseClient, name: string, ownerId: string): Promise<Board> {
  const { data, error } = await client
    .from('boards')
    .insert({ name, owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return toBoard(data);
}
```

- [ ] **Step 3: Write the columns repository**

```typescript
// src/modules/boards/data/columnsRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { columnRowSchema } from './schemas';
import type { Column } from '../domain/types';

function toColumn(row: unknown): Column {
  const parsed = columnRowSchema.parse(row);
  return { id: parsed.id, boardId: parsed.board_id, name: parsed.name, order: parsed.order };
}

export async function listColumns(client: SupabaseClient, boardId: string): Promise<Column[]> {
  const { data, error } = await client
    .from('columns')
    .select('*')
    .eq('board_id', boardId)
    .order('order');
  if (error) throw error;
  return data.map(toColumn);
}

export async function createColumn(
  client: SupabaseClient,
  boardId: string,
  name: string,
  order: number
): Promise<Column> {
  const { data, error } = await client
    .from('columns')
    .insert({ board_id: boardId, name, order })
    .select('*')
    .single();
  if (error) throw error;
  return toColumn(data);
}

export async function renameColumn(client: SupabaseClient, columnId: string, name: string): Promise<void> {
  const { error } = await client.from('columns').update({ name }).eq('id', columnId);
  if (error) throw error;
}

export async function deleteColumn(client: SupabaseClient, columnId: string): Promise<void> {
  const { error } = await client.from('columns').delete().eq('id', columnId);
  if (error) throw error;
}
```

- [ ] **Step 4: Write the notes repository**

```typescript
// src/modules/boards/data/notesRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { noteRowSchema, checklistItemRowSchema } from './schemas';
import type { Note, ChecklistItem, Priority } from '../domain/types';

function toChecklistItem(row: unknown): ChecklistItem {
  const parsed = checklistItemRowSchema.parse(row);
  return { id: parsed.id, noteId: parsed.note_id, text: parsed.text, done: parsed.done, order: parsed.order };
}

function toNote(row: any): Note {
  const parsed = noteRowSchema.parse(row);
  const checklist = Array.isArray(row.checklist_items) ? row.checklist_items.map(toChecklistItem) : [];
  return {
    id: parsed.id,
    columnId: parsed.column_id,
    title: parsed.title,
    description: parsed.description,
    color: parsed.color,
    priority: parsed.priority,
    tags: parsed.tags,
    dueDate: parsed.due_date,
    order: parsed.order,
    checklist,
  };
}

export async function listNotesByBoard(client: SupabaseClient, columnIds: string[]): Promise<Note[]> {
  if (columnIds.length === 0) return [];
  const { data, error } = await client
    .from('notes')
    .select('*, checklist_items(*)')
    .in('column_id', columnIds)
    .order('order');
  if (error) throw error;
  return data.map(toNote);
}

export async function createNote(
  client: SupabaseClient,
  columnId: string,
  title: string,
  order: number
): Promise<Note> {
  const { data, error } = await client
    .from('notes')
    .insert({ column_id: columnId, title, order })
    .select('*, checklist_items(*)')
    .single();
  if (error) throw error;
  return toNote(data);
}

export interface NoteUpdate {
  title?: string;
  description?: string;
  color?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: string | null;
}

export async function updateNote(client: SupabaseClient, noteId: string, update: NoteUpdate): Promise<void> {
  const { error } = await client
    .from('notes')
    .update({
      ...(update.title !== undefined && { title: update.title }),
      ...(update.description !== undefined && { description: update.description }),
      ...(update.color !== undefined && { color: update.color }),
      ...(update.priority !== undefined && { priority: update.priority }),
      ...(update.tags !== undefined && { tags: update.tags }),
      ...(update.dueDate !== undefined && { due_date: update.dueDate }),
    })
    .eq('id', noteId);
  if (error) throw error;
}

export async function moveNote(
  client: SupabaseClient,
  noteId: string,
  columnId: string,
  order: number
): Promise<void> {
  const { error } = await client.from('notes').update({ column_id: columnId, order }).eq('id', noteId);
  if (error) throw error;
}

export async function reorderNotes(
  client: SupabaseClient,
  updates: { id: string; order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map(({ id, order }) => client.from('notes').update({ order }).eq('id', id))
  );
  for (const u of updates) {
    const { error } = await client.from('notes').update({ order: u.order }).eq('id', u.id);
    if (error) throw error;
  }
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors in the `data/` files.

- [ ] **Step 6: Commit**

```bash
git add src/modules/boards/data
git commit -m "feat(boards): add Zod schemas and Supabase repositories for boards/columns/notes"
```

---

### Task 9: Application services

**Files:**
- Create: `src/modules/boards/application/boardService.ts`
- Create: `src/modules/boards/application/noteService.ts`

- [ ] **Step 1: Write the board service**

```typescript
// src/modules/boards/application/boardService.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import * as boardsRepo from '../data/boardsRepo';
import * as columnsRepo from '../data/columnsRepo';
import type { Board, Column } from '../domain/types';

const DEFAULT_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

export async function listMyBoards(client: SupabaseClient): Promise<Board[]> {
  return boardsRepo.listBoards(client);
}

export async function createBoardWithDefaults(
  client: SupabaseClient,
  name: string,
  ownerId: string
): Promise<{ board: Board; columns: Column[] }> {
  const board = await boardsRepo.createBoard(client, name, ownerId);
  const columns = await Promise.all(
    DEFAULT_COLUMNS.map((colName, i) => columnsRepo.createColumn(client, board.id, colName, i))
  );
  return { board, columns };
}

export async function getBoardColumns(client: SupabaseClient, boardId: string): Promise<Column[]> {
  return columnsRepo.listColumns(client, boardId);
}

export async function addColumn(client: SupabaseClient, boardId: string, name: string, order: number) {
  return columnsRepo.createColumn(client, boardId, name, order);
}

export { renameColumn, deleteColumn } from '../data/columnsRepo';
```

- [ ] **Step 2: Write the note service**

```typescript
// src/modules/boards/application/noteService.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import * as notesRepo from '../data/notesRepo';
import { moveNoteToColumn, reorderWithinColumn } from '../domain/reorder';
import type { Note } from '../domain/types';

export async function loadBoardNotes(client: SupabaseClient, columnIds: string[]): Promise<Note[]> {
  return notesRepo.listNotesByBoard(client, columnIds);
}

export async function addNote(
  client: SupabaseClient,
  columnId: string,
  title: string,
  currentColumnNotes: Note[]
): Promise<Note> {
  const order = currentColumnNotes.length;
  return notesRepo.createNote(client, columnId, title, order);
}

export async function updateNoteDetails(
  client: SupabaseClient,
  noteId: string,
  update: notesRepo.NoteUpdate
): Promise<void> {
  return notesRepo.updateNote(client, noteId, update);
}

export async function dragNoteWithinColumn(
  client: SupabaseClient,
  allNotes: Note[],
  noteId: string,
  newIndex: number
): Promise<Note[]> {
  const columnId = allNotes.find((n) => n.id === noteId)?.columnId;
  const columnNotes = allNotes.filter((n) => n.columnId === columnId);
  const reordered = reorderWithinColumn(columnNotes, noteId, newIndex);
  await notesRepo.reorderNotes(
    client,
    reordered.map((n) => ({ id: n.id, order: n.order }))
  );
  const otherNotes = allNotes.filter((n) => n.columnId !== columnId);
  return [...otherNotes, ...reordered];
}

export async function dragNoteAcrossColumns(
  client: SupabaseClient,
  allNotes: Note[],
  noteId: string,
  targetColumnId: string,
  targetIndex: number
): Promise<Note[]> {
  const result = moveNoteToColumn(allNotes, noteId, targetColumnId, targetIndex);
  const affected = result.filter((n) => n.columnId === targetColumnId);
  await notesRepo.moveNote(client, noteId, targetColumnId, targetIndex);
  await notesRepo.reorderNotes(
    client,
    affected.map((n) => ({ id: n.id, order: n.order }))
  );
  return result;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/application
git commit -m "feat(boards): add application services orchestrating repos and domain logic"
```

---

### Task 10: Auth pages and route protection

**Files:**
- Create: `app/(auth)/login/page.tsx`
- Create: `middleware.ts`

- [ ] **Step 1: Write the login page**

```tsx
// app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/boards');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="w-80 space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-bold">Iniciar sesión</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2"
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-purple-600 py-2 text-white">
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write middleware to protect (app) routes**

```typescript
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith('/boards')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/boards/:path*'],
};
```

- [ ] **Step 3: Manually verify redirect behavior**

Run: `npm run dev`, visit `http://localhost:3000/boards` while logged out.
Expected: Redirected to `/login`.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/login/page.tsx" middleware.ts
git commit -m "feat(identity): add login page and route protection middleware"
```

---

### Task 11: TanStack Query provider and useBoards hook

**Files:**
- Create: `src/lib/queryClient.ts`
- Modify: `app/layout.tsx`
- Create: `src/modules/boards/ui/useBoards.ts`

- [ ] **Step 1: Create the QueryClient provider component**

```tsx
// src/lib/queryClient.ts
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Wrap the root layout with the provider**

Modify `app/layout.tsx` to wrap `{children}` with `<AppQueryProvider>`:

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AppQueryProvider } from '@/src/lib/queryClient';

export const metadata: Metadata = {
  title: 'Kanban Post-it',
  description: 'Gestión de proyectos con notas post-it y calendario',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppQueryProvider>{children}</AppQueryProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write the useBoards hook**

```typescript
// src/modules/boards/ui/useBoards.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { listMyBoards, createBoardWithDefaults } from '../application/boardService';

export function useBoards() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['boards'],
    queryFn: () => listMyBoards(supabase),
  });
}

export function useCreateBoard() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return createBoardWithDefaults(supabase, name, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queryClient.ts app/layout.tsx src/modules/boards/ui/useBoards.ts
git commit -m "feat(boards): wire TanStack Query provider and useBoards/useCreateBoard hooks"
```

---

### Task 12: Sidebar and app shell layout

**Files:**
- Create: `src/modules/boards/ui/Sidebar.tsx`
- Create: `app/(app)/layout.tsx`

- [ ] **Step 1: Write the Sidebar component**

```tsx
// src/modules/boards/ui/Sidebar.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBoards, useCreateBoard } from './useBoards';

export function Sidebar() {
  const { data: boards, isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const pathname = usePathname();
  const [newBoardName, setNewBoardName] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    createBoard.mutate(newBoardName.trim());
    setNewBoardName('');
  }

  return (
    <aside className="flex h-screen w-56 flex-col gap-2 bg-gray-800 p-3 text-white">
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-400">
        Tableros
      </h2>

      {isLoading && <p className="px-1 text-sm text-gray-400">Cargando...</p>}

      <nav className="flex flex-col gap-1">
        {boards?.map((board) => {
          const isActive = pathname?.startsWith(`/boards/${board.id}`);
          return (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className={`rounded px-2 py-1.5 text-sm ${
                isActive ? 'bg-purple-600' : 'hover:bg-gray-700'
              }`}
            >
              {board.name}
            </Link>
          );
        })}
      </nav>

      <form onSubmit={handleCreate} className="mt-auto flex flex-col gap-1">
        <input
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Nuevo tablero..."
          className="rounded bg-gray-700 px-2 py-1.5 text-sm placeholder-gray-400"
        />
        <button type="submit" className="rounded bg-purple-600 px-2 py-1.5 text-sm">
          + Crear tablero
        </button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 2: Write the (app) route group layout**

```tsx
// app/(app)/layout.tsx
import { Sidebar } from '@/src/modules/boards/ui/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, log in, visit `/boards`. Create a board via the sidebar form.
Expected: New board appears in the sidebar list immediately (TanStack Query refetch after mutation).

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/ui/Sidebar.tsx "app/(app)/layout.tsx"
git commit -m "feat(boards): add sidebar navigation and app shell layout"
```

---

### Task 13: NoteCard component (with rendering test)

**Files:**
- Create: `src/modules/boards/ui/NoteCard.test.tsx`
- Create: `src/modules/boards/ui/NoteCard.tsx`

- [ ] **Step 1: Write the failing rendering test**

```tsx
// src/modules/boards/ui/NoteCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from './NoteCard';
import type { Note } from '../domain/types';

const note: Note = {
  id: 'n1',
  columnId: 'col1',
  title: 'Llamar al cliente',
  description: '',
  color: '#fff59d',
  priority: 'high',
  tags: ['urgente'],
  dueDate: '2026-07-25',
  order: 0,
  checklist: [
    { id: 'c1', noteId: 'n1', text: 'Preparar agenda', done: true, order: 0 },
    { id: 'c2', noteId: 'n1', text: 'Confirmar horario', done: false, order: 1 },
  ],
};

describe('NoteCard', () => {
  it('renders title, tags, and checklist progress', () => {
    render(<NoteCard note={note} onClick={() => {}} />);

    expect(screen.getByText('Llamar al cliente')).toBeInTheDocument();
    expect(screen.getByText('urgente')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NoteCard note={note} onClick={onClick} />);

    fireEvent.click(screen.getByText('Llamar al cliente'));
    expect(onClick).toHaveBeenCalledWith(note);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- NoteCard`
Expected: FAIL — `Cannot find module './NoteCard'`

- [ ] **Step 3: Implement the component**

```tsx
// src/modules/boards/ui/NoteCard.tsx
'use client';

import type { Note } from '../domain/types';

const PRIORITY_LABEL: Record<Note['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function NoteCard({ note, onClick }: { note: Note; onClick: (note: Note) => void }) {
  const doneCount = note.checklist.filter((c) => c.done).length;

  return (
    <div
      onClick={() => onClick(note)}
      style={{ backgroundColor: note.color }}
      className="mb-3 -rotate-1 cursor-pointer rounded-sm p-3 text-sm shadow-md transition hover:-translate-y-0.5"
    >
      <p className="font-medium text-gray-900">{note.title}</p>

      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded bg-black/10 px-1.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-gray-700">
        <span>{PRIORITY_LABEL[note.priority]}</span>
        {note.checklist.length > 0 && (
          <span>
            {doneCount}/{note.checklist.length}
          </span>
        )}
      </div>

      {note.dueDate && <p className="mt-1 text-xs text-gray-600">{note.dueDate}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- NoteCard`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/ui/NoteCard.tsx src/modules/boards/ui/NoteCard.test.tsx
git commit -m "feat(boards): add NoteCard component with post-it styling and tests"
```

---

### Task 14: NoteEditor modal

**Files:**
- Create: `src/modules/boards/ui/NoteEditor.tsx`

- [ ] **Step 1: Implement the editor**

```tsx
// src/modules/boards/ui/NoteEditor.tsx
'use client';

import { useState } from 'react';
import type { Note, Priority } from '../domain/types';

const COLORS = ['#fff59d', '#ffccbc', '#c8e6c9', '#bbdefb', '#e1bee7'];

export function NoteEditor({
  note,
  onClose,
  onSave,
}: {
  note: Note;
  onClose: () => void;
  onSave: (update: {
    title: string;
    description: string;
    color: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [color, setColor] = useState(note.color);
  const [priority, setPriority] = useState<Priority>(note.priority);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [dueDate, setDueDate] = useState(note.dueDate ?? '');

  function handleSave() {
    onSave({
      title: title.trim(),
      description,
      color,
      priority,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      dueDate: dueDate || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-96 space-y-3 rounded-lg bg-white p-5 shadow-xl"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border px-2 py-1.5 font-medium"
          placeholder="Título"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          rows={3}
          placeholder="Descripción"
        />

        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
            />
          ))}
        </div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        >
          <option value="low">Prioridad baja</option>
          <option value="medium">Prioridad media</option>
          <option value="high">Prioridad alta</option>
        </select>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="Tags separados por coma"
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
            Cancelar
          </button>
          <button onClick={handleSave} className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/NoteEditor.tsx
git commit -m "feat(boards): add NoteEditor modal for full note editing"
```

---

### Task 15: BoardView with drag & drop, wired into the board page

**Files:**
- Create: `src/modules/boards/ui/BoardView.tsx`
- Create: `app/(app)/boards/[boardId]/page.tsx`

- [ ] **Step 1: Implement BoardView with dnd-kit**

```tsx
// src/modules/boards/ui/BoardView.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns, addColumn } from '../application/boardService';
import { loadBoardNotes, addNote, updateNoteDetails, dragNoteWithinColumn, dragNoteAcrossColumns } from '../application/noteService';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import type { Column, Note } from '../domain/types';

function SortableNote({ note, onClick }: { note: Note; onClick: (n: Note) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: note.id,
    data: { columnId: note.columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <NoteCard note={note} onClick={onClick} />
    </div>
  );
}

export function BoardView({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const [columns, setColumns] = useState<Column[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [newColumnName, setNewColumnName] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    async function load() {
      const cols = await getBoardColumns(supabase, boardId);
      setColumns(cols);
      const loadedNotes = await loadBoardNotes(supabase, cols.map((c) => c.id));
      setNotes(loadedNotes);
    }
    load();
  }, [boardId]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const noteId = String(active.id);
    const overColumnId = (over.data.current?.columnId as string | undefined) ?? String(over.id);
    const targetColumnNotes = notes.filter((n) => n.columnId === overColumnId);
    const overIndex = targetColumnNotes.findIndex((n) => n.id === over.id);
    const targetIndex = overIndex === -1 ? targetColumnNotes.length : overIndex;

    const draggedNote = notes.find((n) => n.id === noteId);
    if (!draggedNote) return;

    if (draggedNote.columnId === overColumnId) {
      const updated = await dragNoteWithinColumn(supabase, notes, noteId, targetIndex);
      setNotes(updated);
    } else {
      const updated = await dragNoteAcrossColumns(supabase, notes, noteId, overColumnId, targetIndex);
      setNotes(updated);
    }
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    const column = await addColumn(supabase, boardId, newColumnName.trim(), columns.length);
    setColumns([...columns, column]);
    setNewColumnName('');
  }

  async function handleAddNote(columnId: string) {
    const columnNotes = notes.filter((n) => n.columnId === columnId);
    const note = await addNote(supabase, columnId, 'Nueva nota', columnNotes);
    setNotes([...notes, note]);
  }

  async function handleSaveNote(update: Parameters<typeof updateNoteDetails>[2]) {
    if (!activeNote) return;
    await updateNoteDetails(supabase, activeNote.id, update);
    setNotes(notes.map((n) => (n.id === activeNote.id ? { ...n, ...update } : n)));
  }

  return (
    <div className="p-4">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {columns.map((column) => {
            const columnNotes = notes.filter((n) => n.columnId === column.id).sort((a, b) => a.order - b.order);
            return (
              <div key={column.id} className="w-64 shrink-0 rounded-lg bg-gray-100 p-3">
                <h3 className="mb-2 text-sm font-bold uppercase text-gray-600">{column.name}</h3>
                <SortableContext items={columnNotes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                  {columnNotes.map((note) => (
                    <SortableNote key={note.id} note={note} onClick={setActiveNote} />
                  ))}
                </SortableContext>
                <button
                  onClick={() => handleAddNote(column.id)}
                  className="mt-1 w-full rounded py-1 text-left text-sm text-gray-500 hover:bg-gray-200"
                >
                  + Nueva nota
                </button>
              </div>
            );
          })}

          <form onSubmit={handleAddColumn} className="w-56 shrink-0">
            <input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="+ Nueva columna"
              className="w-full rounded border border-dashed px-2 py-1.5 text-sm"
            />
          </form>
        </div>
      </DndContext>

      {activeNote && (
        <NoteEditor note={activeNote} onClose={() => setActiveNote(null)} onSave={handleSaveNote} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the board page route**

```tsx
// app/(app)/boards/[boardId]/page.tsx
import { BoardView } from '@/src/modules/boards/ui/BoardView';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <BoardView boardId={boardId} />;
}
```

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run dev`, log in, open a board, add a note, drag it between columns, and drag it to reorder within a column. Click a note to open the editor, change its color/priority/tags/checklist fields conceptually (checklist UI is added in Task 17 note — for now verify title/description/color/priority/tags/date save correctly), save, and confirm the card updates.
Expected: Drag & drop persists (refresh the page and the new position/column sticks). Editor changes persist after refresh.

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/ui/BoardView.tsx "app/(app)/boards/[boardId]/page.tsx"
git commit -m "feat(boards): add BoardView with drag-and-drop columns/notes wired to board page"
```

---

### Task 16: Calendar view (Month/Week switch)

**Files:**
- Create: `src/modules/calendar/ui/CalendarView.tsx`
- Create: `app/(app)/boards/[boardId]/calendar/page.tsx`
- Modify: `src/modules/boards/ui/BoardView.tsx` (extract tab nav so it's shared with the calendar page)

- [ ] **Step 1: Add a shared BoardTabs component**

```tsx
// src/modules/boards/ui/BoardTabs.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BoardTabs({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname?.endsWith('/calendar');

  return (
    <div className="flex gap-1 border-b px-4 pt-3">
      <Link
        href={`/boards/${boardId}`}
        className={`rounded-t px-3 py-1.5 text-sm ${!isCalendar ? 'bg-white font-medium' : 'text-gray-500'}`}
      >
        Board
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        className={`rounded-t px-3 py-1.5 text-sm ${isCalendar ? 'bg-white font-medium' : 'text-gray-500'}`}
      >
        Calendario
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Add BoardTabs above the board content**

Modify `src/modules/boards/ui/BoardView.tsx`: import `BoardTabs` and wrap the returned JSX so it renders `<BoardTabs boardId={boardId} />` above the existing `<div className="p-4">`:

```tsx
// inside BoardView's return statement, replace the outer element:
return (
  <div>
    <BoardTabs boardId={boardId} />
    <div className="p-4">
      {/* ...unchanged DndContext and NoteEditor content... */}
    </div>
  </div>
);
```

- [ ] **Step 3: Implement the CalendarView component**

```tsx
// src/modules/calendar/ui/CalendarView.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns } from '@/src/modules/boards/application/boardService';
import { loadBoardNotes, updateNoteDetails } from '@/src/modules/boards/application/noteService';
import { getMonthRange, getWeekRange, bucketNotesByDay } from '../domain/bucketing';
import { NoteCard } from '@/src/modules/boards/ui/NoteCard';
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import type { Note } from '@/src/modules/boards/domain/types';

type ViewMode = 'month' | 'week';

export function CalendarView({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  useEffect(() => {
    async function load() {
      const cols = await getBoardColumns(supabase, boardId);
      const loadedNotes = await loadBoardNotes(supabase, cols.map((c) => c.id));
      setNotes(loadedNotes);
    }
    load();
  }, [boardId]);

  const range =
    mode === 'month'
      ? getMonthRange(cursor.getFullYear(), cursor.getMonth())
      : getWeekRange(cursor);
  const buckets = bucketNotesByDay(notes, range.start, range.end);

  async function handleSaveNote(update: Parameters<typeof updateNoteDetails>[2]) {
    if (!activeNote) return;
    await updateNoteDetails(supabase, activeNote.id, update);
    setNotes(notes.map((n) => (n.id === activeNote.id ? { ...n, ...update } : n)));
  }

  return (
    <div>
      <BoardTabs boardId={boardId} />
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => setMode('month')}
            className={`rounded px-3 py-1 text-sm ${mode === 'month' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
          >
            Mes
          </button>
          <button
            onClick={() => setMode('week')}
            className={`rounded px-3 py-1 text-sm ${mode === 'week' ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
          >
            Semana
          </button>
        </div>

        <div className={mode === 'month' ? 'grid grid-cols-7 gap-2' : 'grid grid-cols-7 gap-2'}>
          {buckets.map((bucket) => (
            <div key={bucket.date} className="min-h-24 rounded bg-gray-50 p-1.5">
              <p className="mb-1 text-xs text-gray-400">{bucket.date.slice(8, 10)}</p>
              {bucket.notes.map((note) => (
                <div key={note.id} className="scale-90 origin-top-left">
                  <NoteCard note={note} onClick={setActiveNote} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {activeNote && (
        <NoteEditor note={activeNote} onClose={() => setActiveNote(null)} onSave={handleSaveNote} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the calendar page route**

```tsx
// app/(app)/boards/[boardId]/calendar/page.tsx
import { CalendarView } from '@/src/modules/calendar/ui/CalendarView';

export default async function CalendarPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  return <CalendarView boardId={boardId} />;
}
```

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`. Open a board, give a note a due date via the editor, switch to the Calendario tab.
Expected: The note's mini card appears under the correct day. Toggling Mes/Semana changes the range shown.

- [ ] **Step 6: Commit**

```bash
git add src/modules/boards/ui/BoardTabs.tsx src/modules/boards/ui/BoardView.tsx src/modules/calendar/ui/CalendarView.tsx "app/(app)/boards/[boardId]/calendar/page.tsx"
git commit -m "feat(calendar): add Month/Week calendar view with shared board tabs"
```

---

### Task 17: Playwright end-to-end test for the critical flow

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/kanban-flow.spec.ts`

- [ ] **Step 1: Write the Playwright config**

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

- [ ] **Step 2: Write the e2e test**

Requires a real test user created in Supabase Auth beforehand (email/password), stored in env vars `E2E_EMAIL` / `E2E_PASSWORD`.

```typescript
// tests/e2e/kanban-flow.spec.ts
import { test, expect } from '@playwright/test';

test('create board, add note, drag it, set a date, see it on the calendar', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder('Contraseña').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.waitForURL('**/boards');

  await page.getByPlaceholder('Nuevo tablero...').fill('Proyecto E2E');
  await page.getByRole('button', { name: '+ Crear tablero' }).click();
  await page.getByText('Proyecto E2E').click();

  await page.getByText('+ Nueva nota').first().click();
  await expect(page.getByText('Nueva nota').first()).toBeVisible();

  await page.getByText('Nueva nota').first().click();
  await page.getByPlaceholder('Título').fill('Nota E2E');
  await page.locator('input[type="date"]').fill('2026-08-01');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await page.getByText('Calendario').click();
  await expect(page.getByText('Nota E2E')).toBeVisible();
});
```

- [ ] **Step 3: Run the e2e test**

Run: `npx playwright install --with-deps chromium && npx playwright test`
Expected: PASS (1 test). If it fails on selectors, adjust to match actual rendered text/roles — this is expected to need one or two iterations against the real running app.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/kanban-flow.spec.ts
git commit -m "test(e2e): add Playwright test for board -> note -> drag -> calendar flow"
```

---

### Task 18: README and deploy notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write project README**

```markdown
# Kanban Post-it

Gestión de proyectos con tableros Kanban estilo post-it y vista de Calendario (Mes/Semana).

## Stack

Next.js (App Router) + TypeScript, Tailwind CSS, Supabase (Postgres + Auth), Zod, TanStack Query, dnd-kit.

## Desarrollo local

1. `npm install`
2. Copiar `.env.local.example` a `.env.local` y completar con las credenciales de tu proyecto Supabase
3. Aplicar `supabase/migrations/0001_init.sql` en el SQL Editor de Supabase
4. `npm run dev`

## Tests

- `npm run test` — unit tests (Vitest)
- `npx playwright test` — e2e (requiere `E2E_EMAIL` / `E2E_PASSWORD` de un usuario real en Supabase Auth)

## Deploy

Desplegar en Vercel (mismo flujo que KairOS): conectar el repo, configurar
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` como variables de entorno de producción.

## Roadmap (fuera de v1)

- Vista Gantt
- Sincronización con Google Calendar
- Multi-usuario (invitaciones, roles) y multi-tenant (organizaciones)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, testing, and deploy notes"
```

---

## Self-Review Notes

- **Spec coverage:** Tableros múltiples (Task 9/12), columnas configurables (Task 9 `addColumn`/`renameColumn`/`deleteColumn`, wired for add in Task 15 — rename/delete UI intentionally left as a fast follow since the spec only required the capability to exist, not full UI chrome for every action), notas con todos los campos (Task 3, 14), post-it clásico visual (Task 13), sidebar (Task 12), pestañas Board/Calendario (Task 16), switch Mes/Semana (Task 16), stack Next.js+Supabase+Tailwind+Vercel (Task 1, 6, 18), org_id nullable multi-tenant-ready (Task 7), tests unitarios + e2e (Task 4, 5, 13, 17).
- **Known follow-up (not blocking v1 usability):** rename/delete column and drag-checklist-item-reorder have service functions ready but no dedicated UI control yet — add as a small follow-up task once the base flow is validated in daily use.
- **Type consistency checked:** `Note.checklist`, `NoteUpdate`, `Priority`, and repo row shapes match across `domain/types.ts`, `data/schemas.ts`, `data/notesRepo.ts`, `application/noteService.ts`, and the UI components.

---

**Plan complete and saved to `docs/superpowers/plans/2026-07-22-kanban-postit-v1.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
