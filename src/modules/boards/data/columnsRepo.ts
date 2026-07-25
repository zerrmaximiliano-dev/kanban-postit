import type { SupabaseClient } from '@supabase/supabase-js';
import { columnRowSchema } from './schemas';
import type { Column } from '../domain/types';

function toColumn(row: unknown): Column {
  const parsed = columnRowSchema.parse(row);
  return { id: parsed.id, boardId: parsed.board_id, name: parsed.name, order: parsed.order };
}

export async function listColumns(client: SupabaseClient, boardId: string): Promise<Column[]> {
  const { data, error } = await client
    .from('columns')
    .select('*')
    .eq('board_id', boardId)
    .order('order');
  if (error) throw error;
  return data.map(toColumn);
}

export async function createColumn(
  client: SupabaseClient,
  boardId: string,
  name: string,
  order: number
): Promise<Column> {
  const { data, error } = await client
    .from('columns')
    .insert({ board_id: boardId, name, order })
    .select('*')
    .single();
  if (error) throw error;
  return toColumn(data);
}

export async function renameColumn(client: SupabaseClient, columnId: string, name: string): Promise<void> {
  const { error } = await client.from('columns').update({ name }).eq('id', columnId);
  if (error) throw error;
}

export async function deleteColumn(client: SupabaseClient, columnId: string): Promise<void> {
  const { error } = await client.from('columns').delete().eq('id', columnId);
  if (error) throw error;
}
