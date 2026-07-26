'use client';

import { useEffect, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns } from '@/src/modules/boards/application/boardService';
import {
  loadBoardNotes,
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
import { NoteCard } from '@/src/modules/boards/ui/NoteCard';
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import { BoardHeader } from '@/src/modules/boards/ui/BoardHeader';
import { useBoardTheme } from '@/src/modules/boards/ui/BoardThemeContext';
import { getBoardPalette } from '@/src/modules/boards/domain/palette';
import type { ChecklistItem, Note } from '@/src/modules/boards/domain/types';

type ViewMode = 'month' | 'week';

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function DraggableNote({ note, onOpen, onDelete }: { note: Note; onOpen: (n: Note) => void; onDelete: (n: Note) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: note.id });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="scale-90 origin-top-left"
      {...attributes}
      {...listeners}
    >
      <NoteCard note={note} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

function DayCell({
  bucket,
  onOpenNote,
  onDeleteNote,
}: {
  bucket: DayBucket;
  onOpenNote: (n: Note) => void;
  onDeleteNote: (n: Note) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: bucket.date });

  return (
    <div ref={setNodeRef} className={`min-h-24 rounded p-1.5 shadow-sm ${isOver ? 'bg-sky-50' : 'bg-white'}`}>
      <p className="mb-1 text-xs text-gray-400">{bucket.date.slice(8, 10)}</p>
      {bucket.notes.map((note) => (
        <DraggableNote key={note.id} note={note} onOpen={onOpenNote} onDelete={onDeleteNote} />
      ))}
    </div>
  );
}

export function CalendarView({ boardId }: { boardId: string }) {
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

  const range =
    mode === 'month'
      ? getMonthRange(cursor.getFullYear(), cursor.getMonth())
      : getWeekRange(cursor);
  const buckets = bucketNotesByDay(notes, range.start, range.end);
  const leadingBlanks =
    mode === 'month' ? getMonthLeadingBlankDays(cursor.getFullYear(), cursor.getMonth()) : 0;

  async function handleSaveNote(update: Parameters<typeof updateNoteDetails>[2]) {
    if (!activeNote) return;
    await updateNoteDetails(supabase, activeNote.id, update);
    setNotes(notes.map((n) => (n.id === activeNote.id ? { ...n, ...update } : n)));
  }

  async function handleDeleteNote(note: Note) {
    setNotes(notes.filter((n) => n.id !== note.id));
    await deleteNote(supabase, note.id);
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
    <div>
      <BoardHeader boardId={boardId} />
      <BoardTabs boardId={boardId} />
      <div className="min-h-[calc(100vh-3rem)] p-4" style={{ backgroundColor: palette.light }}>
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-xs font-bold uppercase text-gray-500">
                {label}
              </p>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {buckets.map((bucket) => (
              <DayCell
                key={bucket.date}
                bucket={bucket}
                onOpenNote={setActiveNote}
                onDeleteNote={handleDeleteNote}
              />
            ))}
          </div>

          <DragOverlay>
            {draggingNote && (
              <div className="w-48">
                <NoteCard note={draggingNote} onOpen={() => {}} />
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
