// src/modules/boards/domain/reorder.ts
import type { Note } from './types';

export function reorderWithinColumn(notes: Note[], noteId: string, newIndex: number): Note[] {
  const sorted = [...notes].sort((a, b) => a.order - b.order);
  const fromIndex = sorted.findIndex((n) => n.id === noteId);
  if (fromIndex === -1) return notes;

  const [moved] = sorted.splice(fromIndex, 1);
  sorted.splice(newIndex, 0, moved);

  return sorted.map((n, i) => ({ ...n, order: i }));
}

export function moveNoteToColumn(
  allNotes: Note[],
  noteId: string,
  targetColumnId: string,
  targetIndex: number
): Note[] {
  const note = allNotes.find((n) => n.id === noteId);
  if (!note) return allNotes;

  const withoutNote = allNotes.filter((n) => n.id !== noteId);

  const targetColumnNotes = withoutNote
    .filter((n) => n.columnId === targetColumnId)
    .sort((a, b) => a.order - b.order);

  const movedNote: Note = { ...note, columnId: targetColumnId, order: targetIndex };
  targetColumnNotes.splice(targetIndex, 0, movedNote);
  const reorderedTarget = targetColumnNotes.map((n, i) => ({ ...n, order: i }));

  const sourceColumnId = note.columnId;
  const otherNotes = withoutNote.filter((n) => n.columnId !== targetColumnId);

  const sourceColumnNotes = otherNotes
    .filter((n) => n.columnId === sourceColumnId)
    .sort((a, b) => a.order - b.order);
  const reorderedSource = sourceColumnNotes.map((n, i) => ({ ...n, order: i }));

  const remainingNotes = otherNotes.filter((n) => n.columnId !== sourceColumnId);

  return [...remainingNotes, ...reorderedSource, ...reorderedTarget];
}
