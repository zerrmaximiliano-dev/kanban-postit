import type { SupabaseClient } from '@supabase/supabase-js';
import * as notesRepo from '../data/notesRepo';
import { moveNoteToColumn, reorderWithinColumn } from '../domain/reorder';
import type { Note } from '../domain/types';

export async function loadBoardNotes(client: SupabaseClient, columnIds: string[]): Promise<Note[]> {
  return notesRepo.listNotesByBoard(client, columnIds);
}

export async function addNote(
  client: SupabaseClient,
  columnId: string,
  title: string,
  currentColumnNotes: Note[]
): Promise<Note> {
  const order = currentColumnNotes.length;
  return notesRepo.createNote(client, columnId, title, order);
}

export async function updateNoteDetails(
  client: SupabaseClient,
  noteId: string,
  update: notesRepo.NoteUpdate
): Promise<void> {
  return notesRepo.updateNote(client, noteId, update);
}

export async function deleteNote(client: SupabaseClient, noteId: string): Promise<void> {
  return notesRepo.deleteNote(client, noteId);
}

export async function addChecklistItem(client: SupabaseClient, noteId: string, text: string, order: number) {
  return notesRepo.createChecklistItem(client, noteId, text, order);
}

export async function updateChecklistItem(
  client: SupabaseClient,
  itemId: string,
  update: { text?: string; done?: boolean }
): Promise<void> {
  return notesRepo.updateChecklistItem(client, itemId, update);
}

export async function deleteChecklistItem(client: SupabaseClient, itemId: string): Promise<void> {
  return notesRepo.deleteChecklistItem(client, itemId);
}

// These compute the new list synchronously (no I/O) so the caller can update
// the UI immediately, then call the matching persist* function without
// awaiting it in the render path — avoids the drag feeling "stuck" while
// waiting on the network before the drop visually settles.

export function computeReorderWithinColumn(allNotes: Note[], noteId: string, newIndex: number): Note[] {
  const columnId = allNotes.find((n) => n.id === noteId)?.columnId;
  const columnNotes = allNotes.filter((n) => n.columnId === columnId);
  const reordered = reorderWithinColumn(columnNotes, noteId, newIndex);
  const otherNotes = allNotes.filter((n) => n.columnId !== columnId);
  return [...otherNotes, ...reordered];
}

export function computeMoveToColumn(
  allNotes: Note[],
  noteId: string,
  targetColumnId: string,
  targetIndex: number
): Note[] {
  return moveNoteToColumn(allNotes, noteId, targetColumnId, targetIndex);
}

export async function persistReorder(client: SupabaseClient, notes: Note[]): Promise<void> {
  await notesRepo.reorderNotes(
    client,
    notes.map((n) => ({ id: n.id, order: n.order }))
  );
}

export async function persistMove(
  client: SupabaseClient,
  noteId: string,
  columnId: string,
  order: number
): Promise<void> {
  await notesRepo.moveNote(client, noteId, columnId, order);
}
