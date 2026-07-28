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
        aria-label={pendingCount > 0 ? `Miembros del tablero — ${pendingCount} solicitud pendiente` : 'Miembros del tablero'}
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
