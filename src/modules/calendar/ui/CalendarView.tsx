'use client';

import { useEffect, useState } from 'react';
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
import { getMonthRange, getWeekRange, bucketNotesByDay } from '../domain/bucketing';
import { NoteCard } from '@/src/modules/boards/ui/NoteCard';
import { NoteEditor } from '@/src/modules/boards/ui/NoteEditor';
import { BoardTabs } from '@/src/modules/boards/ui/BoardTabs';
import { BoardHeader } from '@/src/modules/boards/ui/BoardHeader';
import type { ChecklistItem, Note } from '@/src/modules/boards/domain/types';

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

        <div className="grid grid-cols-7 gap-2">
          {buckets.map((bucket) => (
            <div key={bucket.date} className="min-h-24 rounded bg-gray-50 p-1.5">
              <p className="mb-1 text-xs text-gray-400">{bucket.date.slice(8, 10)}</p>
              {bucket.notes.map((note) => (
                <div key={note.id} className="scale-90 origin-top-left">
                  <NoteCard note={note} onOpen={setActiveNote} onDelete={handleDeleteNote} />
                </div>
              ))}
            </div>
          ))}
        </div>
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
