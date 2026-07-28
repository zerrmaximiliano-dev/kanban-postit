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
