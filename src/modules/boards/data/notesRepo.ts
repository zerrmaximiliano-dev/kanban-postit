import type { SupabaseClient } from '@supabase/supabase-js';
import { noteRowSchema, checklistItemRowSchema } from './schemas';
import type { Note, ChecklistItem, Priority } from '../domain/types';

function toChecklistItem(row: unknown): ChecklistItem {
  const parsed = checklistItemRowSchema.parse(row);
  return { id: parsed.id, noteId: parsed.note_id, text: parsed.text, done: parsed.done, order: parsed.order };
}

function toNote(row: any): Note {
  const parsed = noteRowSchema.parse(row);
  const checklist = Array.isArray(row.checklist_items) ? row.checklist_items.map(toChecklistItem) : [];
  return {
    id: parsed.id,
    columnId: parsed.column_id,
    title: parsed.title,
    description: parsed.description,
    color: parsed.color,
    priority: parsed.priority,
    tags: parsed.tags,
    dueDate: parsed.due_date,
    order: parsed.order,
    checklist,
  };
}

export async function listNotesByBoard(client: SupabaseClient, columnIds: string[]): Promise<Note[]> {
  if (columnIds.length === 0) return [];
  const { data, error } = await client
    .from('notes')
    .select('*, checklist_items(*)')
    .in('column_id', columnIds)
    .order('order');
  if (error) throw error;
  return data.map(toNote);
}

export async function createNote(
  client: SupabaseClient,
  columnId: string,
  title: string,
  order: number
): Promise<Note> {
  const { data, error } = await client
    .from('notes')
    .insert({ column_id: columnId, title, order })
    .select('*, checklist_items(*)')
    .single();
  if (error) throw error;
  return toNote(data);
}

export interface NoteUpdate {
  title?: string;
  description?: string;
  color?: string;
  priority?: Priority;
  tags?: string[];
  dueDate?: string | null;
}

export async function updateNote(client: SupabaseClient, noteId: string, update: NoteUpdate): Promise<void> {
  const { error } = await client
    .from('notes')
    .update({
      ...(update.title !== undefined && { title: update.title }),
      ...(update.description !== undefined && { description: update.description }),
      ...(update.color !== undefined && { color: update.color }),
      ...(update.priority !== undefined && { priority: update.priority }),
      ...(update.tags !== undefined && { tags: update.tags }),
      ...(update.dueDate !== undefined && { due_date: update.dueDate }),
    })
    .eq('id', noteId);
  if (error) throw error;
}

export async function moveNote(
  client: SupabaseClient,
  noteId: string,
  columnId: string,
  order: number
): Promise<void> {
  const { error } = await client.from('notes').update({ column_id: columnId, order }).eq('id', noteId);
  if (error) throw error;
}

export async function reorderNotes(
  client: SupabaseClient,
  updates: { id: string; order: number }[]
): Promise<void> {
  for (const u of updates) {
    const { error } = await client.from('notes').update({ order: u.order }).eq('id', u.id);
    if (error) throw error;
  }
}
