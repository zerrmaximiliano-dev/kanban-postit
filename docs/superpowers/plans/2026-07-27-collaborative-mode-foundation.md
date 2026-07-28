# Collaborative Mode — Foundation (Sharing & Realtime Sync) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a board owner share a board with other people (by email invite or shareable link), with Owner/Editor/Viewer roles enforced in the database, and have every connected client see column/note/checklist changes live without refreshing.

**Architecture:** A new `board_members` table (with RLS policies driven by two `security definer` helper functions to avoid self-referential-policy recursion) replaces the current "owner_id only" access model across `boards`/`columns`/`notes`/`checklist_items`. Invites go through a Next.js Server Action that uses the Supabase service-role key server-side only (never shipped to the client) to create/invite the auth user, then inserts the membership row through the normal RLS-checked path. Joining via a shareable link goes through a `security definer` Postgres RPC function instead of a permissive INSERT policy, so an arbitrary authenticated user can only ever insert themselves as `viewer`, never anyone else or any other role. Live sync uses Supabase Realtime's `postgres_changes` (not a new service) inside a single `useBoardRealtime` hook that both `BoardView` and `CalendarView` mount, replacing their current one-shot `useEffect` load.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres, Auth Admin API, Realtime `postgres_changes`), `@supabase/supabase-js`, `@supabase/ssr`, Zod, TanStack Query (unaffected by this plan), Vitest.

**Relationship to the spec:** This plan implements the "Modelo de datos", "Invitar y unirse", and "Migración del estado local a sincronizado" sections of `docs/superpowers/specs/2026-07-27-collaborative-mode-design.md`. Presence, live cursors, soft-lock editing, note assignment, and in-app notifications are **out of scope for this plan** — they depend on this foundation existing and will be their own follow-up plans once this one is merged and verified in production.

---

### Task 1: Migration — `board_members` table, `share_token`, and RLS helper functions

**Files:**
- Create: `supabase/migrations/0004_board_members.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0004_board_members.sql

create table board_members (
  board_id uuid not null references boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_email text null,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

alter table boards add column share_token uuid not null default gen_random_uuid();

alter table board_members enable row level security;

-- security definer functions: these run with the privileges of their owner
-- (not the calling user), which is the documented way to check membership
-- of the same table a policy is protecting without Postgres reporting
-- "infinite recursion detected in policy" for a self-referential EXISTS.
create or replace function is_board_member(target_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from board_members
    where board_id = target_board_id and user_id = auth.uid()
  );
$$;

create or replace function board_role(target_board_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from board_members
  where board_id = target_board_id and user_id = auth.uid()
  limit 1;
$$;

-- Every board gets its owner's membership row created automatically.
-- Runs as security definer so it can insert before any board_members
-- row exists yet for this board (the normal INSERT policy below requires
-- board_role() = 'owner', which would otherwise be impossible for the
-- very first row of a brand new board).
create or replace function create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into board_members (board_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'accepted');
  return new;
end;
$$;

create trigger boards_after_insert_owner_membership
  after insert on boards
  for each row execute function create_owner_membership();

create policy "Members can view their board's member list" on board_members
  for select using (is_board_member(board_id));

create policy "Owners can add members" on board_members
  for insert with check (board_role(board_id) = 'owner');

create policy "Owners can change member roles" on board_members
  for update using (board_role(board_id) = 'owner') with check (board_role(board_id) = 'owner');

create policy "Owners can remove members" on board_members
  for delete using (board_role(board_id) = 'owner');

-- Lets a logged-in user join a board via its share link as a viewer,
-- without needing a permissive "anyone can insert themselves" policy
-- that would let them pick their own role.
create or replace function join_board_via_token(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
begin
  select id into target_board_id from boards where share_token = token;
  if target_board_id is null then
    raise exception 'Invalid share link';
  end if;

  insert into board_members (board_id, user_id, role, status)
  values (target_board_id, auth.uid(), 'viewer', 'accepted')
  on conflict (board_id, user_id) do nothing;

  return target_board_id;
end;
$$;
```

- [ ] **Step 2: Apply the migration to the local/dev Supabase project**

Run: `npx supabase db push`
Expected: output lists `0004_board_members.sql` as applied, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_board_members.sql
git commit -m "Add board_members table, share_token column, and RLS helper functions"
```

---

### Task 2: Migration — update RLS policies on `boards`, `columns`, `notes`, `checklist_items`

**Files:**
- Create: `supabase/migrations/0005_membership_rls.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0005_membership_rls.sql

drop policy "Owners manage their boards" on boards;

create policy "Members can view boards they belong to" on boards
  for select using (is_board_member(id));

create policy "Authenticated users can create boards" on boards
  for insert with check (owner_id = auth.uid());

create policy "Owners and editors can update boards" on boards
  for update using (board_role(id) in ('owner', 'editor'))
  with check (board_role(id) in ('owner', 'editor'));

create policy "Owners can delete boards" on boards
  for delete using (board_role(id) = 'owner');

drop policy "Owners manage columns of their boards" on columns;

create policy "Members can view columns" on columns
  for select using (is_board_member(board_id));

create policy "Owners and editors manage columns" on columns
  for insert with check (board_role(board_id) in ('owner', 'editor'));

create policy "Owners and editors update columns" on columns
  for update using (board_role(board_id) in ('owner', 'editor'))
  with check (board_role(board_id) in ('owner', 'editor'));

create policy "Owners and editors delete columns" on columns
  for delete using (board_role(board_id) in ('owner', 'editor'));

drop policy "Owners manage notes in their boards" on notes;

create policy "Members can view notes" on notes
  for select using (
    is_board_member((select board_id from columns where id = notes.column_id))
  );

create policy "Owners and editors manage notes" on notes
  for insert with check (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

create policy "Owners and editors update notes" on notes
  for update using (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  )
  with check (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

create policy "Owners and editors delete notes" on notes
  for delete using (
    board_role((select board_id from columns where id = notes.column_id)) in ('owner', 'editor')
  );

drop policy "Owners manage checklist items in their notes" on checklist_items;

create policy "Members can view checklist items" on checklist_items
  for select using (
    is_board_member((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    ))
  );

create policy "Owners and editors manage checklist items" on checklist_items
  for insert with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors update checklist items" on checklist_items
  for update using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  )
  with check (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );

create policy "Owners and editors delete checklist items" on checklist_items
  for delete using (
    board_role((
      select c.board_id from notes n join columns c on c.id = n.column_id
      where n.id = checklist_items.note_id
    )) in ('owner', 'editor')
  );
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: `0005_membership_rls.sql` applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_membership_rls.sql
git commit -m "Replace owner-only RLS with board_members role checks (owner/editor can write, any member can read)"
```

---

### Task 3: Domain types and Zod schemas for `BoardMember` and `Board.shareToken`

**Files:**
- Modify: `src/modules/boards/domain/types.ts`
- Modify: `src/modules/boards/data/schemas.ts`
- Modify: `src/modules/boards/data/boardsRepo.ts`

- [ ] **Step 1: Add `BoardMember` types and `shareToken` to `Board`**

In `src/modules/boards/domain/types.ts`, replace:

```ts
export interface Board {
  id: string;
  name: string;
  ownerId: string;
  orgId: string | null;
  color: string | null;
}
```

with:

```ts
export interface Board {
  id: string;
  name: string;
  ownerId: string;
  orgId: string | null;
  color: string | null;
  shareToken: string;
}

export type BoardMemberRole = 'owner' | 'editor' | 'viewer';
export type BoardMemberStatus = 'pending' | 'accepted';

export interface BoardMember {
  boardId: string;
  userId: string;
  invitedEmail: string | null;
  role: BoardMemberRole;
  status: BoardMemberStatus;
}
```

- [ ] **Step 2: Add the matching Zod schemas**

In `src/modules/boards/data/schemas.ts`, replace:

```ts
export const boardRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_id: z.string().uuid(),
  org_id: z.string().uuid().nullable(),
  color: z.string().nullable(),
});
```

with:

```ts
export const boardRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  owner_id: z.string().uuid(),
  org_id: z.string().uuid().nullable(),
  color: z.string().nullable(),
  share_token: z.string().uuid(),
});

export const boardMemberRowSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  invited_email: z.string().nullable(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'accepted']),
});
```

- [ ] **Step 3: Map `share_token` in `boardsRepo.ts`**

In `src/modules/boards/data/boardsRepo.ts`, replace:

```ts
function toBoard(row: unknown): Board {
  const parsed = boardRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner_id,
    orgId: parsed.org_id,
    color: parsed.color,
  };
}
```

with:

```ts
function toBoard(row: unknown): Board {
  const parsed = boardRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner_id,
    orgId: parsed.org_id,
    color: parsed.color,
    shareToken: parsed.share_token,
  };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (all call sites of `Board`/`boardRowSchema` still satisfy the type since `shareToken` is only ever produced by `toBoard`, never constructed manually elsewhere).

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/domain/types.ts src/modules/boards/data/schemas.ts src/modules/boards/data/boardsRepo.ts
git commit -m "Add BoardMember domain type and Board.shareToken"
```

---

### Task 4: `boardMembersRepo.ts`

**Files:**
- Create: `src/modules/boards/data/boardMembersRepo.ts`

- [ ] **Step 1: Write the repo**

```ts
// src/modules/boards/data/boardMembersRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { boardMemberRowSchema } from './schemas';
import type { BoardMember, BoardMemberRole, BoardMemberStatus } from '../domain/types';

function toBoardMember(row: unknown): BoardMember {
  const parsed = boardMemberRowSchema.parse(row);
  return {
    boardId: parsed.board_id,
    userId: parsed.user_id,
    invitedEmail: parsed.invited_email,
    role: parsed.role,
    status: parsed.status,
  };
}

export async function listMembers(client: SupabaseClient, boardId: string): Promise<BoardMember[]> {
  const { data, error } = await client.from('board_members').select('*').eq('board_id', boardId);
  if (error) throw error;
  return data.map(toBoardMember);
}

export async function isOwner(client: SupabaseClient, boardId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role === 'owner';
}

export async function addMember(
  client: SupabaseClient,
  member: {
    boardId: string;
    userId: string;
    invitedEmail: string | null;
    role: BoardMemberRole;
    status: BoardMemberStatus;
  }
): Promise<BoardMember> {
  const { data, error } = await client
    .from('board_members')
    .insert({
      board_id: member.boardId,
      user_id: member.userId,
      invited_email: member.invitedEmail,
      role: member.role,
      status: member.status,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toBoardMember(data);
}

export async function updateMemberRole(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(client: SupabaseClient, boardId: string, userId: string): Promise<void> {
  const { error } = await client.from('board_members').delete().eq('board_id', boardId).eq('user_id', userId);
  if (error) throw error;
}

export async function joinViaShareLink(client: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await client.rpc('join_board_via_token', { token });
  if (error) throw error;
  return data as string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/data/boardMembersRepo.ts
git commit -m "Add boardMembersRepo for membership CRUD and share-link join"
```

---

### Task 5: Server-only Supabase admin client

**Files:**
- Create: `src/modules/identity/data/supabaseAdminClient.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the admin client factory**

```ts
// src/modules/identity/data/supabaseAdminClient.ts
// SERVER-ONLY. Uses the service-role key, which bypasses RLS entirely.
// Only ever import this from a 'use server' file (Server Actions) or a
// server Route Handler — never from a 'use client' component.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

- [ ] **Step 2: Document the new env var**

In `.env.example`, add after the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` line:

```
# Server-only. From Supabase project settings → API → service_role key.
# Never expose this to the client — only read from Server Actions/Route Handlers.
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/identity/data/supabaseAdminClient.ts .env.example
git commit -m "Add server-only Supabase admin client for the service-role key"
```

---

### Task 6: `memberService.ts` — invite, list, role change, remove

**Files:**
- Create: `src/modules/boards/application/memberService.ts`

- [ ] **Step 1: Write the server actions**

```ts
// src/modules/boards/application/memberService.ts
'use server';

import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/modules/identity/data/supabaseServerClient';
import { createAdminClient } from '@/src/modules/identity/data/supabaseAdminClient';
import * as boardMembersRepo from '../data/boardMembersRepo';
import type { BoardMember, BoardMemberRole } from '../domain/types';

// The Admin API has no "get user by email" call, so an existing user is
// found by listing and filtering. This is O(n) in total user count, which
// is an accepted simplification for this app's expected scale (small
// teams sharing a handful of boards) — revisit if user count grows large.
async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<User | null> {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listBoardMembers(boardId: string): Promise<BoardMember[]> {
  const supabase = await createServerSupabaseClient();
  return boardMembersRepo.listMembers(supabase, boardId);
}

export async function inviteMemberByEmail(boardId: string, email: string): Promise<BoardMember> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const callerIsOwner = await boardMembersRepo.isOwner(supabase, boardId, user.id);
  if (!callerIsOwner) throw new Error('Solo el dueño del tablero puede invitar');

  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, email);

  let targetUserId: string;
  let status: 'pending' | 'accepted';

  if (existing) {
    targetUserId = existing.id;
    status = 'accepted';
  } else {
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);
    targetUserId = invited.user.id;
    status = 'pending';
  }

  return boardMembersRepo.addMember(supabase, {
    boardId,
    userId: targetUserId,
    invitedEmail: email,
    role: 'editor',
    status,
  });
}

export async function updateMemberRole(boardId: string, userId: string, role: BoardMemberRole): Promise<void> {
  if (role === 'owner') throw new Error('No se puede reasignar el rol de dueño');
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.updateMemberRole(supabase, boardId, userId, role);
}

export async function removeMember(boardId: string, userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.removeMember(supabase, boardId, userId);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/application/memberService.ts
git commit -m "Add memberService server actions: invite by email, list/update/remove members"
```

---

### Task 7: Share-link join route and `next`-redirect support on login

**Files:**
- Create: `app/join/[token]/page.tsx`
- Modify: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Write the join route**

```tsx
// app/join/[token]/page.tsx
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/src/modules/identity/data/supabaseServerClient';
import { joinViaShareLink } from '@/src/modules/boards/data/boardMembersRepo';

export default async function JoinBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  let boardId: string;
  try {
    boardId = await joinViaShareLink(supabase, token);
  } catch {
    redirect('/boards?error=invalid-invite');
  }

  redirect(`/boards/${boardId}`);
}
```

- [ ] **Step 2: Add `next` redirect support to the login page**

In `app/(auth)/login/page.tsx`, replace:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';

export default function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
```

with:

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';

export default function LoginPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/boards';
```

Then, still in `app/(auth)/login/page.tsx`, replace both occurrences of `router.push('/boards');` with `router.push(next);`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual check**

Run the dev server, visit `/join/00000000-0000-0000-0000-000000000000` while logged out.
Expected: redirected to `/login?next=%2Fjoin%2F00000000-0000-0000-0000-000000000000`; after logging in, redirected back to `/join/...`, which then redirects to `/boards?error=invalid-invite` (since that token doesn't exist).

- [ ] **Step 5: Commit**

```bash
git add "app/join/[token]/page.tsx" "app/(auth)/login/page.tsx"
git commit -m "Add /join/[token] share-link route and next-redirect support on login"
```

---

### Task 8: `MembersPopover` UI, wired into `BoardHeader`

**Files:**
- Modify: `src/modules/ui/icons.tsx`
- Create: `src/modules/boards/ui/MembersPopover.tsx`
- Modify: `src/modules/boards/ui/BoardHeader.tsx`

- [ ] **Step 1: Add a `UsersIcon`**

In `src/modules/ui/icons.tsx`, add after `CalendarIcon`:

```tsx
export function UsersIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="7" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12.5 12.2c1.9.3 3 1.5 3 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2: Write `MembersPopover.tsx`**

```tsx
// src/modules/boards/ui/MembersPopover.tsx
'use client';

import { useEffect, useState } from 'react';
import { useClickOutside } from '@/src/modules/ui/useClickOutside';
import { useToast } from '@/src/modules/ui/Toast';
import { UsersIcon, CloseIcon } from '@/src/modules/ui/icons';
import { listBoardMembers, inviteMemberByEmail, updateMemberRole, removeMember } from '../application/memberService';
import type { BoardMember, BoardMemberRole } from '../domain/types';

const ROLE_LABEL: Record<BoardMemberRole, string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Solo lectura',
};

export function MembersPopover({
  boardId,
  isOwner,
  shareToken,
}: {
  boardId: string;
  isOwner: boolean;
  shareToken: string;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const popoverRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    listBoardMembers(boardId)
      .then(setMembers)
      .catch(() => showToast('No se pudo cargar los miembros', 'danger'));
  }, [open, boardId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    try {
      const member = await inviteMemberByEmail(boardId, trimmed);
      setMembers((prev) => [...prev, member]);
      setEmail('');
      showToast('Invitación enviada');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo invitar', 'danger');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: BoardMemberRole) {
    if (role === 'owner') return;
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    await updateMemberRole(boardId, userId, role);
  }

  async function handleRemove(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    await removeMember(boardId, userId);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/join/${shareToken}`;
    navigator.clipboard.writeText(url);
    showToast('Link copiado');
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-control border border-white/25 bg-white/10 text-white transition-colors duration-150 ease-standard hover:bg-white/20"
        aria-label="Miembros del tablero"
        title="Miembros del tablero"
      >
        <UsersIcon />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 w-80 rounded-card border border-border bg-surface p-3 shadow-elevation-md">
          <p className="mb-2 text-xs font-medium text-ink-muted">Miembros</p>
          <div className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm">
                <span className="flex-1 truncate text-ink">{m.invitedEmail ?? m.userId}</span>
                {isOwner && m.role !== 'owner' ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.userId, e.target.value as BoardMemberRole)}
                    className="rounded-control border border-border bg-surface px-1.5 py-0.5 text-xs text-ink"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Solo lectura</option>
                  </select>
                ) : (
                  <span className="text-xs text-ink-muted">{ROLE_LABEL[m.role]}</span>
                )}
                {isOwner && m.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:text-danger"
                    aria-label={`Quitar a ${m.invitedEmail ?? 'miembro'}`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <form onSubmit={handleInvite} className="mb-2 flex gap-1">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Invitar por email..."
                className="flex-1 rounded-control border border-border bg-page px-2 py-1 text-sm text-ink placeholder-ink-faint focus:border-accent-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={inviting}
                className="rounded-control bg-accent-500 px-2 py-1 text-xs font-medium text-white transition-colors duration-150 ease-standard hover:bg-accent-600 disabled:opacity-50"
              >
                {inviting ? '...' : 'Invitar'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={copyShareLink}
            className="w-full rounded-control border border-border px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-page hover:text-ink"
          >
            Copiar link para compartir
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `BoardHeader.tsx`**

Replace:

```tsx
export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useClickOutside<HTMLDivElement>(() => setPickerOpen(false));

  useEffect(() => {
    let cancelled = false;
    getBoard(supabase, boardId).then((board) => {
      if (!cancelled) {
        setName(board.name);
        setDraft(board.name);
        setColor(board.color);
        setBoardColor(board.color);
      }
    });
    return () => {
      cancelled = true;
      setBoardColor(null);
    };
  }, [boardId]);
```

with:

```tsx
export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const pickerRef = useClickOutside<HTMLDivElement>(() => setPickerOpen(false));

  useEffect(() => {
    let cancelled = false;
    Promise.all([getBoard(supabase, boardId), supabase.auth.getUser()]).then(([board, { data }]) => {
      if (cancelled) return;
      setName(board.name);
      setDraft(board.name);
      setColor(board.color);
      setBoardColor(board.color);
      setShareToken(board.shareToken);
      setIsOwner(data.user?.id === board.ownerId);
    });
    return () => {
      cancelled = true;
      setBoardColor(null);
    };
  }, [boardId]);
```

Then replace:

```tsx
      <div ref={pickerRef} className="relative ml-auto">
```

with:

```tsx
      <div className="ml-auto flex items-center gap-2">
      {shareToken && <MembersPopover boardId={boardId} isOwner={isOwner} shareToken={shareToken} />}
      <div ref={pickerRef} className="relative">
```

And replace the closing of that block — find:

```tsx
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
```

with:

```tsx
            </label>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
```

Finally, add the import at the top of the file:

```tsx
import { MembersPopover } from './MembersPopover';
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ui/icons.tsx src/modules/boards/ui/MembersPopover.tsx src/modules/boards/ui/BoardHeader.tsx
git commit -m "Add MembersPopover: invite by email, share link, role management"
```

---

### Task 9: `useBoardRealtime` hook

**Files:**
- Create: `src/modules/boards/ui/useBoardRealtime.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/modules/boards/ui/useBoardRealtime.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns } from '../application/boardService';
import { loadBoardNotes } from '../application/noteService';
import { columnRowSchema, noteRowSchema, checklistItemRowSchema } from '../data/schemas';
import type { Column, Note } from '../domain/types';

type Row = Record<string, unknown>;

function columnFromRow(row: Row): Column {
  const parsed = columnRowSchema.parse(row);
  return { id: parsed.id, boardId: parsed.board_id, name: parsed.name, order: parsed.order };
}

function noteFromRow(row: Row, checklist: Note['checklist']): Note {
  const parsed = noteRowSchema.parse(row);
  return {
    id: parsed.id,
    columnId: parsed.column_id,
    title: parsed.title,
    description: parsed.description,
    color: parsed.color,
    priority: parsed.priority,
    tags: parsed.tags,
    startDate: parsed.start_date,
    endDate: parsed.end_date,
    order: parsed.order,
    checklist,
  };
}

export function useBoardRealtime(boardId: string) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const columnIdsRef = useRef<Set<string>>(new Set());
  const noteIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    columnIdsRef.current = new Set(columns.map((c) => c.id));
  }, [columns]);

  useEffect(() => {
    noteIdsRef.current = new Set(notes.map((n) => n.id));
  }, [notes]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const cols = await getBoardColumns(supabase, boardId);
      const loadedNotes = await loadBoardNotes(supabase, cols.map((c) => c.id));
      if (cancelled) return;
      setColumns(cols);
      setNotes(loadedNotes);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            setColumns((prev) => prev.filter((c) => c.id !== oldId));
            return;
          }
          const column = columnFromRow(payload.new as Row);
          setColumns((prev) =>
            prev.some((c) => c.id === column.id)
              ? prev.map((c) => (c.id === column.id ? column : c))
              : [...prev, column]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId || !noteIdsRef.current.has(oldId)) return;
            setNotes((prev) => prev.filter((n) => n.id !== oldId));
            return;
          }
          const row = payload.new as Row;
          const columnId = row.column_id as string;
          const noteId = row.id as string;
          if (!columnIdsRef.current.has(columnId) && !noteIdsRef.current.has(noteId)) return;
          setNotes((prev) => {
            const existing = prev.find((n) => n.id === noteId);
            const note = noteFromRow(row, existing?.checklist ?? []);
            return existing ? prev.map((n) => (n.id === noteId ? note : n)) : [...prev, note];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string; note_id?: string };
            if (!oldRow.note_id || !noteIdsRef.current.has(oldRow.note_id)) return;
            setNotes((prev) =>
              prev.map((n) =>
                n.id === oldRow.note_id
                  ? { ...n, checklist: n.checklist.filter((c) => c.id !== oldRow.id) }
                  : n
              )
            );
            return;
          }
          const parsed = checklistItemRowSchema.parse(payload.new);
          if (!noteIdsRef.current.has(parsed.note_id)) return;
          const item = { id: parsed.id, noteId: parsed.note_id, text: parsed.text, done: parsed.done, order: parsed.order };
          setNotes((prev) =>
            prev.map((n) => {
              if (n.id !== item.noteId) return n;
              const exists = n.checklist.some((c) => c.id === item.id);
              return {
                ...n,
                checklist: exists
                  ? n.checklist.map((c) => (c.id === item.id ? item : c))
                  : [...n.checklist, item],
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return { columns, notes, setColumns, setNotes, loading };
}
```

A note on "own change bounce": the spec raised the risk of a client's own optimistic update getting overwritten by the realtime echo of that same write. In practice this hook applies changes by replacing-by-id with the latest row from the database, so the echo of your own write reapplies identical data — a no-op re-render, not a flicker or rollback. No extra de-duplication logic is needed; this is simpler than what the spec anticipated and is called out here rather than building unused machinery for it.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/ui/useBoardRealtime.ts
git commit -m "Add useBoardRealtime: loads a board once, then syncs columns/notes/checklist via Postgres Changes"
```

---

### Task 10: Wire `useBoardRealtime` into `BoardView.tsx`

**Files:**
- Modify: `src/modules/boards/ui/BoardView.tsx`

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { useEffect, useState } from 'react';
```

with:

```tsx
import { useState } from 'react';
```

Replace:

```tsx
import { getBoardColumns, addColumn, renameColumn, deleteColumn } from '../application/boardService';
import {
  loadBoardNotes,
  addNote,
```

with:

```tsx
import { addColumn, renameColumn, deleteColumn } from '../application/boardService';
import {
  addNote,
```

Add, alongside the other same-directory imports (near `import { MiniCalendarPanel } from './MiniCalendarPanel';`):

```tsx
import { useBoardRealtime } from './useBoardRealtime';
```

- [ ] **Step 2: Replace the local load with the hook**

Replace:

```tsx
  const [columns, setColumns] = useState<Column[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [overCalendarDay, setOverCalendarDay] = useState(false);
  const [arrival, setArrival] = useState<CalendarArrival | null>(null);

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
```

with:

```tsx
  const { columns, notes, setColumns, setNotes } = useBoardRealtime(boardId);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');
  const [overCalendarDay, setOverCalendarDay] = useState(false);
  const [arrival, setArrival] = useState<CalendarArrival | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (`Column`/`Note` types are still imported and used elsewhere in the file, e.g. in `activeNote`/`draggingNote` state and prop types, so those type imports stay as-is.)

- [ ] **Step 4: Run the existing test suite**

Run: `npm test`
Expected: all existing tests still pass (`BoardView.tsx` itself has no direct unit tests, but `NoteCard.test.tsx` and `reorder.test.ts` must be unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/ui/BoardView.tsx
git commit -m "Wire BoardView to useBoardRealtime instead of a one-shot local load"
```

---

### Task 11: Wire `useBoardRealtime` into `CalendarView.tsx`

**Files:**
- Modify: `src/modules/calendar/ui/CalendarView.tsx`

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { useEffect, useState } from 'react';
```

with:

```tsx
import { useState } from 'react';
```

Replace:

```tsx
import { getBoardColumns } from '@/src/modules/boards/application/boardService';
import {
  loadBoardNotes,
  updateNoteDetails,
```

with:

```tsx
import {
  updateNoteDetails,
```

Add, alongside the other `boards/ui` imports:

```tsx
import { useBoardRealtime } from '@/src/modules/boards/ui/useBoardRealtime';
```

- [ ] **Step 2: Replace the local load with the hook**

Replace:

```tsx
  const supabase = createClient();
  const { boardColor } = useBoardTheme();
  const palette = getBoardPalette(boardColor);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => {
    async function load() {
      const cols = await getBoardColumns(supabase, boardId);
      const loadedNotes = await loadBoardNotes(supabase, cols.map((c) => c.id));
      setNotes(loadedNotes);
    }
    load();
  }, [boardId]);
```

with:

```tsx
  const supabase = createClient();
  const { boardColor } = useBoardTheme();
  const palette = getBoardPalette(boardColor);
  const { notes, setNotes } = useBoardRealtime(boardId);
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
```

(`supabase` stays — it's still used by every mutation handler further down in the file, e.g. `handleSaveNote`, `handleDeleteNote`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the existing test suite**

Run: `npm test`
Expected: all existing tests still pass, including `bucketing.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/modules/calendar/ui/CalendarView.tsx
git commit -m "Wire CalendarView to the same useBoardRealtime hook as BoardView"
```

---

### Task 12: Manual RLS verification

This task has no automated test — Vitest runs in a single process and can't exercise Postgres RLS as two different authenticated users. Do this manually against the dev Supabase project before merging.

**Files:** none (verification only).

- [ ] **Step 1: Set up two accounts**

Sign up two accounts in the app (Account A and Account B) via `/login`, e.g. `a@example.com` / `b@example.com`.

- [ ] **Step 2: Verify a non-member cannot read a board**

As Account A, create a board and note its `boardId` from the URL (`/boards/<id>`). Log in as Account B in a different browser/incognito window and navigate directly to `/boards/<A's board id>`.
Expected: the board loads with no columns/notes (RLS `select` returns zero rows for a non-member) rather than showing Account A's data or throwing an unhandled error.

- [ ] **Step 3: Verify email invite grants access**

As Account A, open the Members popover on that board and invite `b@example.com`. Refresh as Account B (already logged in) and navigate to `/boards/<A's board id>` again.
Expected: Account B now sees the board's columns and notes.

- [ ] **Step 4: Verify a viewer cannot write**

As Account A, change Account B's role to "Solo lectura" in the Members popover. As Account B, try to add a note or rename a column.
Expected: the write is rejected (Supabase returns a permission error caught by the existing `try`/error paths in the mutation handlers — check the browser console shows an RLS-denial error, and the UI does not show the change persisting after a refresh).

- [ ] **Step 5: Verify the share link**

As Account A, click "Copiar link para compartir" and open that URL in a third account's session (Account C, not previously invited).
Expected: Account C is added as a viewer and lands on the board; Account A's Members popover now lists Account C with role "Solo lectura".

- [ ] **Step 6: Verify live sync**

With Account A and Account B both viewing the same board (Account B as editor, from Step 3/redo the role change back to editor), have Account A add a note.
Expected: the note appears in Account B's browser within a couple of seconds, with no manual refresh.

- [ ] **Step 7: Record the result**

If all six checks pass, proceed to Task 13. If any fails, fix the underlying policy/code before continuing — do not merge with a known RLS gap.

---

### Task 13: Final verification and deploy

**Files:** none (verification and deploy only).

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass (13 existing + none new, since this plan's changes are either DB/server-action code or thin wiring not covered by unit tests — see the spec's Testing section for why).

- [ ] **Step 3: Confirm migrations are applied to production Supabase**

Run: `npx supabase db push --linked` (or the project's existing production migration command)
Expected: `0004_board_members.sql` and `0005_membership_rls.sql` show as applied with no errors.

- [ ] **Step 4: Set the production env var**

Add `SUPABASE_SERVICE_ROLE_KEY` to the Vercel project's environment variables (Production), using the service-role key from Supabase project settings → API. This must happen before deploying, or `inviteMemberByEmail` will throw on first use in production.

- [ ] **Step 5: Commit and push**

```bash
git push origin master
```

Expected: Vercel picks up the push and deploys; confirm with `npx vercel ls kanban-postit --yes` that the new deployment reaches `Ready`.

- [ ] **Step 6: Smoke-test in production**

Repeat Task 12's Step 6 (live sync) against the production URL with two real accounts, since Supabase Realtime behavior can differ between local/dev and the deployed environment (network conditions, connection pooling).

---

## Follow-up plans (not part of this plan)

Once this plan is merged and verified in production:
- **Plan 2 — Presence, live cursors, soft-lock editing** (Presence/Broadcast channels, `BoardHeader` avatar row, cursor overlay in `BoardView`, `NoteEditor` lock state).
- **Plan 3 — Note assignment and notifications** (`note_assignees` table, assignee avatars on `NoteCard`, "solo mis notas" filter, `notifications` table and bell icon).

Each should get its own brainstorming pass focused on integration details once the realtime foundation is live, per the spec's non-goals section.
