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

export async function dragNoteWithinColumn(
  client: SupabaseClient,
  allNotes: Note[],
  noteId: string,
  newIndex: number
): Promise<Note[]> {
  const columnId = allNotes.find((n) => n.id === noteId)?.columnId;
  const columnNotes = allNotes.filter((n) => n.columnId === columnId);
  const reordered = reorderWithinColumn(columnNotes, noteId, newIndex);
  await notesRepo.reorderNotes(
    client,
    reordered.map((n) => ({ id: n.id, order: n.order }))
  );
  const otherNotes = allNotes.filter((n) => n.columnId !== columnId);
  return [...otherNotes, ...reordered];
}

export async function dragNoteAcrossColumns(
  client: SupabaseClient,
  allNotes: Note[],
  noteId: string,
  targetColumnId: string,
  targetIndex: number
): Promise<Note[]> {
  const result = moveNoteToColumn(allNotes, noteId, targetColumnId, targetIndex);
  const affected = result.filter((n) => n.columnId === targetColumnId);
  await notesRepo.moveNote(client, noteId, targetColumnId, targetIndex);
  await notesRepo.reorderNotes(
    client,
    affected.map((n) => ({ id: n.id, order: n.order }))
  );
  return result;
}
