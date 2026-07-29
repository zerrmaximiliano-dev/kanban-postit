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

              {selectedArrow && canEdit && (
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
