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
import { BoardTabs } from './BoardTabs';
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
    <div>
      <BoardTabs boardId={boardId} />
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
    </div>
  );
}
