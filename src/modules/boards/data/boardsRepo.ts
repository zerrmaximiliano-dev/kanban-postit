import type { SupabaseClient } from '@supabase/supabase-js';
import { boardRowSchema } from './schemas';
import type { Board } from '../domain/types';

function toBoard(row: unknown): Board {
  const parsed = boardRowSchema.parse(row);
  return {
    id: parsed.id,
    name: parsed.name,
    ownerId: parsed.owner_id,
    orgId: parsed.org_id,
    color: parsed.color,
  };
}

export async function listBoards(client: SupabaseClient): Promise<Board[]> {
  const { data, error } = await client.from('boards').select('*').order('created_at');
  if (error) throw error;
  return data.map(toBoard);
}

export async function createBoard(client: SupabaseClient, name: string, ownerId: string): Promise<Board> {
  const { data, error } = await client
    .from('boards')
    .insert({ name, owner_id: ownerId })
    .select('*')
    .single();
  if (error) throw error;
  return toBoard(data);
}

export async function getBoard(client: SupabaseClient, boardId: string): Promise<Board> {
  const { data, error } = await client.from('boards').select('*').eq('id', boardId).single();
  if (error) throw error;
  return toBoard(data);
}

export async function renameBoard(client: SupabaseClient, boardId: string, name: string): Promise<void> {
  const { error } = await client.from('boards').update({ name }).eq('id', boardId);
  if (error) throw error;
}

export async function deleteBoard(client: SupabaseClient, boardId: string): Promise<void> {
  const { error } = await client.from('boards').delete().eq('id', boardId);
  if (error) throw error;
}

export async function updateBoardColor(client: SupabaseClient, boardId: string, color: string): Promise<void> {
  const { error } = await client.from('boards').update({ color }).eq('id', boardId);
  if (error) throw error;
}
