import type { SupabaseClient } from '@supabase/supabase-js';
import { noteDependencyRowSchema } from './schemas';
import type { NoteDependency } from '../domain/types';

function toNoteDependency(row: unknown): NoteDependency {
  const parsed = noteDependencyRowSchema.parse(row);
  return {
    id: parsed.id,
    predecessorNoteId: parsed.predecessor_note_id,
    successorNoteId: parsed.successor_note_id,
  };
}

// Dependencies only ever connect two notes on the same board (both ends are
// always drawn from the caller's own board in the Gantt view), so filtering
// on predecessor_note_id alone is enough to scope the query to this board's
// notes — no separate board_id column needed on this table.
export async function listDependencies(client: SupabaseClient, noteIds: string[]): Promise<NoteDependency[]> {
  if (noteIds.length === 0) return [];
  const { data, error } = await client.from('note_dependencies').select('*').in('predecessor_note_id', noteIds);
  if (error) throw error;
  return data.map(toNoteDependency);
}

export async function addDependency(
  client: SupabaseClient,
  predecessorNoteId: string,
  successorNoteId: string
): Promise<NoteDependency> {
  const { data, error } = await client
    .from('note_dependencies')
    .insert({ predecessor_note_id: predecessorNoteId, successor_note_id: successorNoteId })
    .select('*')
    .single();
  if (error) throw error;
  return toNoteDependency(data);
}

export async function removeDependency(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('note_dependencies').delete().eq('id', id);
  if (error) throw error;
}
