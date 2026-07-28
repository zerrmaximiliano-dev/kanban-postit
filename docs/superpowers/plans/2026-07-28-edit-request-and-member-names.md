# Edit-Access Requests + Real Member Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a viewer request edit access (visible to the owner as an Approve/Reject row plus a pending-request dot on the Members button), let members set a display name once they're editor/owner, and always show a real email instead of a raw UUID in the member list.

**Architecture:** Extends the existing `board_members` table with two columns (`display_name`, `edit_requested`) instead of adding new tables. Reuses the already-broadened meaning of `invited_email` (now "this member's email, however they joined") by fixing the two write paths that don't yet populate it and backfilling existing rows. A new RLS policy lets a member update their own row, guarded by a `before update` trigger (same pattern as the existing `boards.owner_id`/`share_token` guard) that blocks a self-service update from touching `role`/`invited_email`/`status` — only the owner's separate policy can do that.

**Tech Stack:** Postgres RLS + `security definer` functions/triggers (same patterns already used in this codebase), Next.js Server Actions, React/Tailwind — no new dependencies.

---

### Task 1: Migration — schema, email backfill, self-update RLS, guard trigger

**Files:**
- Create: `supabase/migrations/0011_edit_requests_and_display_names.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0011_edit_requests_and_display_names.sql

alter table board_members add column display_name text null;
alter table board_members add column edit_requested boolean not null default false;

-- Backfill: any existing row missing invited_email (owner rows created by the
-- trigger before this fix, or share-link joins before this fix) gets it filled
-- from auth.users. Safe to run multiple times (no-op once populated).
update board_members bm
set invited_email = u.email
from auth.users u
where bm.user_id = u.id and bm.invited_email is null;

-- Capture the owner's email at membership-creation time from now on.
create or replace function create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_email text;
begin
  select email into owner_email from auth.users where id = new.owner_id;
  insert into board_members (board_id, user_id, role, status, invited_email)
  values (new.id, new.owner_id, 'owner', 'accepted', owner_email);
  return new;
end;
$$;

-- Capture the joiner's email at share-link join time from now on.
create or replace function join_board_via_token(token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_board_id uuid;
  joiner_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into target_board_id from boards where share_token = token;
  if target_board_id is null then
    raise exception 'Invalid share link';
  end if;

  select email into joiner_email from auth.users where id = auth.uid();

  insert into board_members (board_id, user_id, role, status, invited_email)
  values (target_board_id, auth.uid(), 'viewer', 'accepted', joiner_email)
  on conflict (board_id, user_id) do nothing;

  return target_board_id;
end;
$$;

-- Members can update their own row (needed so a viewer can set edit_requested,
-- and any member can set display_name, without going through the owner).
create policy "Members can update their own membership row" on board_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- RLS can't restrict which COLUMNS an update touches, only which ROWS. The
-- policy above would otherwise let a viewer PATCH their own role to 'editor'
-- directly. This trigger closes that: any change to role/invited_email/status
-- requires the caller to be the board's owner, regardless of which policy let
-- the UPDATE through. board_role() looks up the caller's own role via
-- auth.uid(), so this doesn't affect the owner's normal "change someone else's
-- role" path (their board_role() really is 'owner').
create or replace function guard_member_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.invited_email is distinct from old.invited_email
      or new.status is distinct from old.status)
     and board_role(old.board_id) is distinct from 'owner' then
    raise exception 'Only the board owner can change role, email, or status';
  end if;
  return new;
end;
$$;

create trigger board_members_before_update_guard_self
  before update on board_members
  for each row execute function guard_member_self_update();
```

- [ ] **Step 2: Apply the migration to production**

Run: `npx supabase db push`
Expected: `0011_edit_requests_and_display_names.sql` applied with no errors. This is a real production database — confirm with the user before running this step if you're an agent executing autonomously without a human present (per this project's established convention of asking before schema changes that touch the live database).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_edit_requests_and_display_names.sql
git commit -m "Add display_name/edit_requested columns, capture member email on all join paths, let members self-update their own row (guarded)"
```

---

### Task 2: Domain types, schema, repo functions

**Files:**
- Modify: `src/modules/boards/domain/types.ts`
- Modify: `src/modules/boards/data/schemas.ts`
- Modify: `src/modules/boards/data/boardMembersRepo.ts`

- [ ] **Step 1: Extend `BoardMember`**

In `src/modules/boards/domain/types.ts`, replace:

```ts
export interface BoardMember {
  boardId: string;
  userId: string;
  invitedEmail: string | null;
  role: BoardMemberRole;
  status: BoardMemberStatus;
}
```

with:

```ts
export interface BoardMember {
  boardId: string;
  userId: string;
  invitedEmail: string | null;
  displayName: string | null;
  editRequested: boolean;
  role: BoardMemberRole;
  status: BoardMemberStatus;
}
```

- [ ] **Step 2: Extend the Zod schema**

In `src/modules/boards/data/schemas.ts`, replace:

```ts
export const boardMemberRowSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  invited_email: z.string().nullable(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'accepted']),
});
```

with:

```ts
export const boardMemberRowSchema = z.object({
  board_id: z.string().uuid(),
  user_id: z.string().uuid(),
  invited_email: z.string().nullable(),
  display_name: z.string().nullable(),
  edit_requested: z.boolean(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'accepted']),
});
```

- [ ] **Step 3: Update the mapper and add two repo functions**

In `src/modules/boards/data/boardMembersRepo.ts`, replace:

```ts
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
```

with:

```ts
function toBoardMember(row: unknown): BoardMember {
  const parsed = boardMemberRowSchema.parse(row);
  return {
    boardId: parsed.board_id,
    userId: parsed.user_id,
    invitedEmail: parsed.invited_email,
    displayName: parsed.display_name,
    editRequested: parsed.edit_requested,
    role: parsed.role,
    status: parsed.status,
  };
}
```

Then add these two functions at the end of the file (after `joinViaShareLink`):

```ts
export async function setEditRequested(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  requested: boolean
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ edit_requested: requested })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setDisplayName(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  displayName: string
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ display_name: displayName })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `MembersPopover.tsx` at this point are expected and will be fixed in Task 5 (it constructs `BoardMember`-shaped objects in optimistic updates that are missing the two new fields until then) — if `tsc` shows errors ONLY in that file, that's fine to leave for now; anything else must be fixed here.

- [ ] **Step 5: Commit**

```bash
git add src/modules/boards/domain/types.ts src/modules/boards/data/schemas.ts src/modules/boards/data/boardMembersRepo.ts
git commit -m "Add displayName/editRequested to BoardMember, plus setEditRequested/setDisplayName repo functions"
```

---

### Task 3: Server actions

**Files:**
- Modify: `src/modules/boards/application/memberService.ts`

- [ ] **Step 1: Add four server actions**

At the end of `src/modules/boards/application/memberService.ts`, add:

```ts
export async function requestEditAccess(boardId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const myRole = await boardMembersRepo.getMyRole(supabase, boardId);
  if (myRole !== 'viewer') throw new Error('Solo un miembro de solo lectura puede solicitar edición');

  await boardMembersRepo.setEditRequested(supabase, boardId, user.id, true);
}

export async function approveEditRequest(boardId: string, userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.updateMemberRole(supabase, boardId, userId, 'editor');
  await boardMembersRepo.setEditRequested(supabase, boardId, userId, false);
}

export async function rejectEditRequest(boardId: string, userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.setEditRequested(supabase, boardId, userId, false);
}

export async function setDisplayName(boardId: string, name: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const myRole = await boardMembersRepo.getMyRole(supabase, boardId);
  if (myRole === 'viewer' || myRole === null) throw new Error('Necesitás ser editor para elegir un nombre');

  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre no puede estar vacío');

  await boardMembersRepo.setDisplayName(supabase, boardId, user.id, trimmed);
}
```

## Context for this task

`approveEditRequest`/`rejectEditRequest` are owner-only in practice because they call `boardMembersRepo.updateMemberRole`/`setEditRequested`, which run through the RLS-scoped (non-admin) `supabase` client — a non-owner caller's update would simply affect 0 rows under the `"Owners can change member roles"` policy (for `approveEditRequest`'s role change) — but `setEditRequested` on someone ELSE's row has no owner-only guard of its own beyond RLS's "Members can update their own membership row" (self only) policy, meaning a non-owner calling `rejectEditRequest(boardId, someoneElsesUserId)` would silently affect 0 rows too (RLS blocks it since `user_id = auth.uid()` fails for someone else's row, and there's no other policy that would let a non-owner touch another row). This is the correct behavior already — no code change needed, just understand why it's safe: RLS is the actual boundary here, same as the existing `updateMemberRole`/`removeMember` functions in this file.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from this file (pre-existing `MembersPopover.tsx` errors from Task 2 are still expected until Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/modules/boards/application/memberService.ts
git commit -m "Add requestEditAccess/approveEditRequest/rejectEditRequest/setDisplayName server actions"
```

---

### Task 4: `BoardHeader.tsx` — reuse `useBoardRole`, pass `myRole`/`myUserId`

**Files:**
- Modify: `src/modules/boards/ui/BoardHeader.tsx`

- [ ] **Step 1: Replace the manual owner-check with `useBoardRole`**

Replace:

```tsx
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard, updateBoardColor } from '../application/boardService';
import { getBoardPalette, BOARD_COLOR_PRESETS } from '../domain/palette';
import { useBoardTheme } from './BoardThemeContext';
import { PaletteIcon } from '@/src/modules/ui/icons';
import { useClickOutside } from '@/src/modules/ui/useClickOutside';
import { MembersPopover } from './MembersPopover';

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

with:

```tsx
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard, updateBoardColor } from '../application/boardService';
import { getBoardPalette, BOARD_COLOR_PRESETS } from '../domain/palette';
import { useBoardTheme } from './BoardThemeContext';
import { useBoardRole } from './useBoardRole';
import { PaletteIcon } from '@/src/modules/ui/icons';
import { useClickOutside } from '@/src/modules/ui/useClickOutside';
import { MembersPopover } from './MembersPopover';

export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const { role: myRole } = useBoardRole(boardId);
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
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
      setMyUserId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      setBoardColor(null);
    };
  }, [boardId]);
```

- [ ] **Step 2: Update the `MembersPopover` call site**

Replace:

```tsx
        {shareToken && <MembersPopover boardId={boardId} isOwner={isOwner} shareToken={shareToken} />}
```

with:

```tsx
        {shareToken && myUserId && (
          <MembersPopover boardId={boardId} myRole={myRole} myUserId={myUserId} shareToken={shareToken} />
        )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: this file's own errors are resolved; `MembersPopover.tsx` will still error until Task 5 rewrites its props (expected, matches Task 2's note).

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/ui/BoardHeader.tsx
git commit -m "BoardHeader: reuse useBoardRole instead of a manual owner check, pass myRole/myUserId to MembersPopover"
```

---

### Task 5: Rewrite `MembersPopover.tsx`

**Files:**
- Modify: `src/modules/boards/ui/MembersPopover.tsx`

- [ ] **Step 1: Replace the whole file**

```tsx
// src/modules/boards/ui/MembersPopover.tsx
'use client';

import { useEffect, useState } from 'react';
import { useClickOutside } from '@/src/modules/ui/useClickOutside';
import { useToast } from '@/src/modules/ui/Toast';
import { UsersIcon, CloseIcon } from '@/src/modules/ui/icons';
import {
  listBoardMembers,
  inviteMemberByEmail,
  updateMemberRole,
  removeMember,
  requestEditAccess,
  approveEditRequest,
  rejectEditRequest,
  setDisplayName,
} from '../application/memberService';
import type { BoardMember, BoardMemberRole } from '../domain/types';

const ROLE_LABEL: Record<BoardMemberRole, string> = {
  owner: 'Dueño',
  editor: 'Editor',
  viewer: 'Solo lectura',
};

function memberLabel(m: BoardMember): string {
  return m.displayName ?? m.invitedEmail ?? 'Miembro';
}

export function MembersPopover({
  boardId,
  myRole,
  myUserId,
  shareToken,
}: {
  boardId: string;
  myRole: BoardMemberRole | null;
  myUserId: string;
  shareToken: string;
}) {
  const { showToast } = useToast();
  const isOwner = myRole === 'owner';
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const popoverRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    if (!open && !isOwner) return;
    listBoardMembers(boardId)
      .then(setMembers)
      .catch(() => showToast('No se pudo cargar los miembros', 'danger'));
  }, [open, boardId, isOwner]);

  const pendingCount = isOwner ? members.filter((m) => m.editRequested).length : 0;
  const myMembership = members.find((m) => m.userId === myUserId);

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
    const previous = members;
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, role } : m)));
    try {
      await updateMemberRole(boardId, userId, role);
    } catch (err) {
      setMembers(previous);
      showToast(err instanceof Error ? err.message : 'No se pudo cambiar el rol', 'danger');
    }
  }

  async function handleRemove(userId: string) {
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    try {
      await removeMember(boardId, userId);
    } catch (err) {
      setMembers(previous);
      showToast(err instanceof Error ? err.message : 'No se pudo quitar al miembro', 'danger');
    }
  }

  async function handleApprove(userId: string) {
    const previous = members;
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: 'editor', editRequested: false } : m))
    );
    try {
      await approveEditRequest(boardId, userId);
      showToast('Acceso de edición aprobado');
    } catch (err) {
      setMembers(previous);
      showToast(err instanceof Error ? err.message : 'No se pudo aprobar', 'danger');
    }
  }

  async function handleReject(userId: string) {
    const previous = members;
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, editRequested: false } : m)));
    try {
      await rejectEditRequest(boardId, userId);
    } catch (err) {
      setMembers(previous);
      showToast(err instanceof Error ? err.message : 'No se pudo rechazar', 'danger');
    }
  }

  async function handleRequestEdit() {
    setRequesting(true);
    try {
      await requestEditAccess(boardId);
      setMembers((prev) => prev.map((m) => (m.userId === myUserId ? { ...m, editRequested: true } : m)));
      showToast('Pedido enviado');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el pedido', 'danger');
    } finally {
      setRequesting(false);
    }
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setSavingName(true);
    try {
      await setDisplayName(boardId, trimmed);
      setMembers((prev) => prev.map((m) => (m.userId === myUserId ? { ...m, displayName: trimmed } : m)));
      showToast('Nombre guardado');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo guardar el nombre', 'danger');
    } finally {
      setSavingName(false);
    }
  }

  function copyShareLink() {
    const url = `${window.location.origin}/join/${shareToken}`;
    navigator.clipboard.writeText(url);
    showToast('Link copiado');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-control border border-white/25 bg-white/10 text-white transition-colors duration-150 ease-standard hover:bg-white/20"
        aria-label="Miembros del tablero"
        title="Miembros del tablero"
      >
        <UsersIcon />
        {pendingCount > 0 && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-10 w-80 rounded-card border border-border bg-surface p-3 shadow-elevation-md">
          <p className="mb-2 text-xs font-medium text-ink-muted">Miembros</p>
          <div className="mb-3 flex max-h-48 flex-col gap-1 overflow-y-auto">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm">
                <span className="flex-1 truncate text-ink">{memberLabel(m)}</span>
                {isOwner && m.editRequested && m.role !== 'owner' ? (
                  <>
                    <span className="text-xs font-medium text-warning">Pidió editar</span>
                    <button
                      type="button"
                      onClick={() => handleApprove(m.userId)}
                      className="rounded-control bg-accent-500 px-1.5 py-0.5 text-xs font-medium text-white transition-colors duration-150 ease-standard hover:bg-accent-600"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(m.userId)}
                      className="rounded-control border border-border px-1.5 py-0.5 text-xs font-medium text-ink-muted transition-colors duration-150 ease-standard hover:text-danger"
                    >
                      Rechazar
                    </button>
                  </>
                ) : isOwner && m.role !== 'owner' ? (
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
                {isOwner && m.role !== 'owner' && !m.editRequested && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.userId)}
                    className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:text-danger"
                    aria-label={`Quitar a ${memberLabel(m)}`}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isOwner && myRole === 'viewer' && (
            <div className="mb-2">
              {myMembership?.editRequested ? (
                <p className="rounded-control bg-page px-2 py-1.5 text-xs text-ink-muted">
                  Pedido enviado, esperando aprobación.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestEdit}
                  disabled={requesting}
                  className="w-full rounded-control bg-accent-500 px-2 py-1.5 text-xs font-medium text-white transition-colors duration-150 ease-standard hover:bg-accent-600 disabled:opacity-50"
                >
                  {requesting ? 'Enviando...' : 'Solicitar edición'}
                </button>
              )}
            </div>
          )}

          {(myRole === 'editor' || myRole === 'owner') && myMembership && !myMembership.displayName && (
            <form onSubmit={handleSaveName} className="mb-2 flex gap-1">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="¿Cómo querés que te vean?"
                className="flex-1 rounded-control border border-border bg-page px-2 py-1 text-sm text-ink placeholder-ink-faint focus:border-accent-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingName}
                className="rounded-control bg-accent-500 px-2 py-1 text-xs font-medium text-white transition-colors duration-150 ease-standard hover:bg-accent-600 disabled:opacity-50"
              >
                {savingName ? '...' : 'Guardar'}
              </button>
            </form>
          )}

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
            className={`w-full rounded-control border px-2 py-1.5 text-xs font-medium transition-all duration-150 ease-standard ${
              copied
                ? 'scale-[0.97] border-accent-500 bg-accent-100 text-accent-600'
                : 'border-border text-ink-muted hover:bg-page hover:text-ink'
            }`}
          >
            {copied ? 'Copiado ✓' : 'Copiar link para compartir'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project now.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test`
Expected: all existing tests still pass (this feature has no Vitest-covered logic, so the count should be unchanged).

- [ ] **Step 4: Commit**

```bash
git add src/modules/boards/ui/MembersPopover.tsx
git commit -m "MembersPopover: show real names/emails, add request/approve/reject edit-access flow and a pending-request badge"
```

---

### Task 6: Final verification and deploy

**Files:** none (verification and deploy only).

- [ ] **Step 1: Full type-check and test suite**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 2: Manual two-account verification**

With two real accounts (one owner, one viewer on the same board):
1. As the viewer, open the Members popover → confirm "Solicitar edición" is visible, click it → confirm it changes to "Pedido enviado, esperando aprobación."
2. As the owner, confirm the red dot appears on the Members button without having opened the popover yet (may need a page refresh, since the badge is computed from a fetch that only happens automatically for the owner — confirm this fetch really does fire on mount per Task 5, not just on open).
3. As the owner, open the popover → confirm the viewer's row shows "Pidió editar" + Aprobar/Rechazar instead of the normal role select. Click Aprobar.
4. As the viewer, refresh (or wait for the realtime-independent next popover open — note this doesn't go through `useBoardRealtime`, so it needs a manual reopen/refresh) → confirm their own role is now Editor, and the "¿Cómo querés que te vean?" name form appears. Set a name.
5. As the owner, reopen the popover → confirm the former viewer now shows the chosen name instead of their email/UUID.

- [ ] **Step 3: Commit and push**

```bash
git push origin master
```

Expected: pushes to `origin master`, triggering a production deploy. Confirm with `npx vercel ls kanban-postit --yes` that the new deployment reaches `Ready`.
