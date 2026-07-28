'use client';

import { useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  Modifier,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import {
  updateNoteDetails,
  deleteNote,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from '@/src/modules/boards/application/noteService';
import {
  getMonthRange,
  getWeekRange,
  getMonthLeadingBlankDays,
  bucketNotesByDay,
  type DayBucket,
} from '../domain/bucketing';

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import { BoardHeader } from '@/src/modules/boards/ui/BoardHeader';
import { useBoardTheme } from '@/src/modules/boards/ui/BoardThemeContext';
import { useBoardRealtime } from '@/src/modules/boards/ui/useBoardRealtime';
import { useBoardRole } from '@/src/modules/boards/ui/useBoardRole';
import { getBoardPalette } from '@/src/modules/boards/domain/palette';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/src/modules/ui/icons';
import type { ChecklistItem, Note } from '@/src/modules/boards/domain/types';

type ViewMode = 'month' | 'week';

const offsetOverlayAboveCursor: Modifier = ({ transform }) => ({
  ...transform,
  y: transform.y - 25,
});

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function DraggableNote({
  note,
  onOpen,
  onUnschedule,
  canEdit,
}: {
  note: Note;
  onOpen: (n: Note) => void;
  onUnschedule: (n: Note) => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: note.id, disabled: !canEdit });

  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => onOpen(note)}
      style={{ backgroundColor: note.color, opacity: isDragging ? 0.4 : 1 }}
      className={`group/pill relative mb-1 flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-xs font-medium text-ink transition-transform duration-150 ease-standard hover:-translate-y-px ${
        canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      }`}
      {...attributes}
      {...listeners}
    >
      <span className="font-note min-w-0 flex-1 truncate text-sm font-bold" title={note.title}>
        {note.title}
      </span>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnschedule(note);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink/50 opacity-0 transition-opacity duration-150 ease-standard hover:bg-black/10 hover:text-ink group-hover/pill:opacity-100"
          aria-label="Quitar del calendario"
          title="Quitar del calendario"
        >
          <CloseIcon className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

const MAX_VISIBLE_NOTES = 4;

function DayCell({
  bucket,
  onOpenNote,
  onUnscheduleNote,
  canEdit,
}: {
  bucket: DayBucket;
  onOpenNote: (n: Note) => void;
  onUnscheduleNote: (n: Note) => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.date });
  const [expanded, setExpanded] = useState(false);

  const visibleNotes = expanded ? bucket.notes : bucket.notes.slice(0, MAX_VISIBLE_NOTES);
  const hiddenCount = bucket.notes.length - visibleNotes.length;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-24 rounded-control p-2 shadow-elevation-sm transition-[box-shadow,background-color] duration-150 ease-standard hover:shadow-elevation-md ${
        isOver ? 'bg-accent-100/40' : 'bg-surface'
      }`}
    >
      <p className="mb-1 text-xs text-ink-faint">{bucket.date.slice(8, 10)}</p>
      <div className="max-h-40 overflow-y-auto">
        {visibleNotes.map((note) => (
          <DraggableNote key={note.id} note={note} onOpen={onOpenNote} onUnschedule={onUnscheduleNote} canEdit={canEdit} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-full bg-page px-2 py-0.5 text-left text-[10px] font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-accent-100 hover:text-accent-600"
        >
          +{hiddenCount} más
        </button>
      )}
      {expanded && bucket.notes.length > MAX_VISIBLE_NOTES && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full rounded-full px-2 py-0.5 text-left text-[10px] font-medium text-ink-muted transition-colors duration-150 ease-standard hover:bg-page"
        >
          Ver menos
        </button>
      )}
    </div>
  );
}

export function CalendarView({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const { boardColor } = useBoardTheme();
  const palette = getBoardPalette(boardColor);
  const { notes, setNotes } = useBoardRealtime(boardId);
  const { canEdit } = useBoardRole(boardId);
  const [mode, setMode] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState(new Date());
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const range =
    mode === 'month'
      ? getMonthRange(cursor.getFullYear(), cursor.getMonth())
      : getWeekRange(cursor);
  const buckets = bucketNotesByDay(notes, range.start, range.end);
  const leadingBlanks =
    mode === 'month' ? getMonthLeadingBlankDays(cursor.getFullYear(), cursor.getMonth()) : 0;

  const rangeLabel =
    mode === 'month'
      ? `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : `${range.start.getUTCDate()} ${MONTH_LABELS[range.start.getUTCMonth()].slice(0, 3)} — ${range.end.getUTCDate()} ${MONTH_LABELS[range.end.getUTCMonth()].slice(0, 3)} ${range.end.getUTCFullYear()}`;

  function goToPrevious() {
    setCursor((c) =>
      mode === 'month'
        ? new Date(c.getFullYear(), c.getMonth() - 1, 1)
        : new Date(c.getFullYear(), c.getMonth(), c.getDate() - 7)
    );
  }

  function goToNext() {
    setCursor((c) =>
      mode === 'month'
        ? new Date(c.getFullYear(), c.getMonth() + 1, 1)
        : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7)
    );
  }

  function goToToday() {
    setCursor(new Date());
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

  async function handleUnscheduleNote(note: Note) {
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, startDate: null, endDate: null } : n)));
    await updateNoteDetails(supabase, note.id, { startDate: null, endDate: null });
  }

  function handleDragStart(event: DragStartEvent) {
    const note = notes.find((n) => n.id === event.active.id);
    setDraggingNote(note ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingNote(null);
    const { active, over } = event;
    if (!over) return;

    const note = notes.find((n) => n.id === active.id);
    if (!note || !note.startDate) return;

    const targetDate = String(over.id);
    const dayDiff = Math.round(
      (new Date(targetDate).getTime() - new Date(note.startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayDiff === 0) return;

    const newStartDate = shiftDate(note.startDate, dayDiff);
    const newEndDate = note.endDate ? shiftDate(note.endDate, dayDiff) : null;

    setNotes(notes.map((n) => (n.id === note.id ? { ...n, startDate: newStartDate, endDate: newEndDate } : n)));
    await updateNoteDetails(supabase, note.id, { startDate: newStartDate, endDate: newEndDate });
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

  return (
    <div className="flex h-full flex-col">
      <BoardHeader boardId={boardId} />
      <BoardTabs boardId={boardId} />
      <div className="flex flex-1 flex-col overflow-hidden p-4" style={{ backgroundColor: palette.light }}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
          <div className="flex gap-4 border-b border-border">
            <button
              onClick={() => setMode('month')}
              className={`border-b-2 py-2 text-sm font-medium transition-colors duration-150 ease-standard ${
                mode === 'month' ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setMode('week')}
              className={`border-b-2 py-2 text-sm font-medium transition-colors duration-150 ease-standard ${
                mode === 'week' ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Semana
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goToPrevious}
              className="rounded-control p-1.5 text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface hover:text-ink"
              aria-label="Anterior"
            >
              <ChevronLeftIcon />
            </button>
            <p className="min-w-[9rem] text-center text-sm font-semibold text-ink">{rangeLabel}</p>
            <button
              type="button"
              onClick={goToNext}
              className="rounded-control p-1.5 text-ink-muted transition-colors duration-150 ease-standard hover:bg-surface hover:text-ink"
              aria-label="Siguiente"
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="ml-2 rounded-control px-2 py-1 text-xs font-medium text-accent-600 transition-colors duration-150 ease-standard hover:bg-accent-100"
            >
              Hoy
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="mb-1 grid shrink-0 grid-cols-7 gap-2 border-b border-border pb-2">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-xs font-bold uppercase text-ink-faint">
                {label}
              </p>
            ))}
          </div>

          <div className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {buckets.map((bucket) => (
                <DayCell
                  key={bucket.date}
                  bucket={bucket}
                  onOpenNote={setActiveNote}
                  onUnscheduleNote={handleUnscheduleNote}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </div>

          <DragOverlay modifiers={[offsetOverlayAboveCursor]}>
            {draggingNote && (
              <div
                style={{ backgroundColor: draggingNote.color }}
                className="font-note max-w-40 truncate rounded-full py-1 px-2.5 text-sm font-bold text-ink shadow-elevation-md opacity-90"
              >
                {draggingNote.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
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
        />
      )}
    </div>
  );
}
