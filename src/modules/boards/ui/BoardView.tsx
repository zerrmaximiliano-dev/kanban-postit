'use client';

import { useEffect, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns, addColumn, renameColumn, deleteColumn } from '../application/boardService';
import {
  loadBoardNotes,
  addNote,
  updateNoteDetails,
  deleteNote,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  computeReorderWithinColumn,
  computeMoveToColumn,
  persistReorder,
  persistMove,
} from '../application/noteService';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { BoardTabs } from './BoardTabs';
import { BoardHeader } from './BoardHeader';
import { MiniCalendarPanel } from './MiniCalendarPanel';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import type { Column, Note, ChecklistItem } from '../domain/types';

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function noteMatchesQuery(note: Note, query: string): boolean {
  const q = query.toLowerCase();
  return (
    note.title.toLowerCase().includes(q) ||
    note.description.toLowerCase().includes(q) ||
    note.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

function SortableNote({
  note,
  onOpen,
  onDelete,
}: {
  note: Note;
  onOpen: (n: Note) => void;
  onDelete: (n: Note) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
    data: { columnId: note.columnId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <NoteCard note={note} onOpen={onOpen} onDelete={onDelete} />
    </div>
  );
}

function BoardColumn({
  column,
  notes,
  accentColor,
  onAddNote,
  onOpenNote,
  onDeleteNote,
  onRename,
  onDeleteColumn,
}: {
  column: Column;
  notes: Note[];
  accentColor: string;
  onAddNote: (columnId: string) => void;
  onOpenNote: (n: Note) => void;
  onDeleteNote: (n: Note) => void;
  onRename: (columnId: string, name: string) => void;
  onDeleteColumn: (column: Column) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column.id });

  function commitRename() {
    setEditing(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === column.name) {
      setName(column.name);
      return;
    }
    onRename(column.id, trimmed);
  }

  return (
    <div className="w-64 shrink-0 rounded-lg bg-white p-3 shadow-sm" style={{ borderTop: `3px solid ${accentColor}` }}>
      <div className="mb-3 flex items-center justify-between pb-1.5">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setName(column.name);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-gray-300 px-1 py-0.5 text-sm font-bold text-gray-800"
          />
        ) : (
          <h3
            onClick={() => setEditing(true)}
            className="cursor-text text-sm font-bold uppercase tracking-wide text-gray-700"
            title="Click para renombrar"
          >
            {column.name}
          </h3>
        )}
        <button
          type="button"
          onClick={() => onDeleteColumn(column)}
          className="ml-2 text-gray-400 hover:text-red-600"
          aria-label={`Eliminar columna ${column.name}`}
        >
          🗑
        </button>
      </div>

      <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setDroppableRef}
          className={`min-h-[3rem] rounded ${isOver ? 'bg-sky-50' : ''}`}
        >
          {notes.map((note) => (
            <SortableNote key={note.id} note={note} onOpen={onOpenNote} onDelete={onDeleteNote} />
          ))}
        </div>
      </SortableContext>

      <button
        onClick={() => onAddNote(column.id)}
        className="mt-1 w-full rounded py-1 text-left text-sm text-gray-400 hover:bg-gray-100"
      >
        + Nueva nota
      </button>
    </div>
  );
}

export function BoardView({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const { boardColor } = useBoardTheme();
  const palette = getBoardPalette(boardColor);
  const [columns, setColumns] = useState<Column[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [draggingNote, setDraggingNote] = useState<Note | null>(null);
  const [query, setQuery] = useState('');

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

  function handleDragStart(event: DragStartEvent) {
    const note = notes.find((n) => n.id === event.active.id);
    setDraggingNote(note ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingNote(null);
    const { active, over } = event;
    if (!over) return;

    const noteId = String(active.id);

    if (over.data.current?.type === 'calendar-day') {
      const targetDate = over.data.current.date as string;
      const draggedNote = notes.find((n) => n.id === noteId);
      if (!draggedNote) return;

      let newStartDate = targetDate;
      let newEndDate: string | null = targetDate;
      if (draggedNote.startDate) {
        const dayDiff = Math.round(
          (new Date(targetDate).getTime() - new Date(draggedNote.startDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        newStartDate = shiftDate(draggedNote.startDate, dayDiff);
        newEndDate = draggedNote.endDate ? shiftDate(draggedNote.endDate, dayDiff) : null;
      }

      setNotes(notes.map((n) => (n.id === noteId ? { ...n, startDate: newStartDate, endDate: newEndDate } : n)));
      updateNoteDetails(supabase, noteId, { startDate: newStartDate, endDate: newEndDate });
      return;
    }

    const overColumnId = (over.data.current?.columnId as string | undefined) ?? String(over.id);
    const targetColumnNotes = notes.filter((n) => n.columnId === overColumnId);
    const overIndex = targetColumnNotes.findIndex((n) => n.id === over.id);
    const targetIndex = overIndex === -1 ? targetColumnNotes.length : overIndex;

    const draggedNote = notes.find((n) => n.id === noteId);
    if (!draggedNote) return;

    if (draggedNote.columnId === overColumnId) {
      const updated = computeReorderWithinColumn(notes, noteId, targetIndex);
      setNotes(updated);
      const reordered = updated.filter((n) => n.columnId === overColumnId);
      persistReorder(supabase, reordered);
    } else {
      const updated = computeMoveToColumn(notes, noteId, overColumnId, targetIndex);
      setNotes(updated);
      const affected = updated.filter((n) => n.columnId === overColumnId);
      persistMove(supabase, noteId, overColumnId, targetIndex);
      persistReorder(supabase, affected);
    }
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    const column = await addColumn(supabase, boardId, newColumnName.trim(), columns.length);
    setColumns([...columns, column]);
    setNewColumnName('');
  }

  async function handleRenameColumn(columnId: string, name: string) {
    setColumns(columns.map((c) => (c.id === columnId ? { ...c, name } : c)));
    await renameColumn(supabase, columnId, name);
  }

  async function handleDeleteColumn(column: Column) {
    if (!window.confirm(`¿Eliminar la columna "${column.name}" y todas sus notas?`)) return;
    setColumns(columns.filter((c) => c.id !== column.id));
    setNotes(notes.filter((n) => n.columnId !== column.id));
    await deleteColumn(supabase, column.id);
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

  return (
    <div>
      <BoardHeader boardId={boardId} />
      <BoardTabs boardId={boardId} />
      <div className="min-h-[calc(100vh-3rem)] p-4" style={{ backgroundColor: palette.light }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar notas por palabra clave..."
          className="mb-4 w-full max-w-sm rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm"
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto">
            {columns.map((column) => {
              const columnNotes = notes
                .filter((n) => n.columnId === column.id)
                .filter((n) => (query.trim() ? noteMatchesQuery(n, query) : true))
                .sort((a, b) => a.order - b.order);
              return (
                <BoardColumn
                  key={column.id}
                  column={column}
                  notes={columnNotes}
                  accentColor={palette.medium}
                  onAddNote={handleAddNote}
                  onOpenNote={setActiveNote}
                  onDeleteNote={handleDeleteNote}
                  onRename={handleRenameColumn}
                  onDeleteColumn={handleDeleteColumn}
                />
              );
            })}

            <form onSubmit={handleAddColumn} className="w-56 shrink-0">
              <input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="+ Nueva columna"
                className="w-full rounded border border-dashed border-gray-400 bg-white/60 px-2 py-1.5 text-sm text-gray-900"
              />
            </form>
          </div>

          <DragOverlay>
            {draggingNote && (
              <div className="w-64">
                <NoteCard note={draggingNote} onOpen={() => {}} />
              </div>
            )}
          </DragOverlay>

          <MiniCalendarPanel notes={notes} accentColor={palette.medium} />
        </DndContext>

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
    </div>
  );
}
