// src/modules/boards/data/boardMembersRepo.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { boardMemberRowSchema } from './schemas';
import type { BoardMember, BoardMemberRole, BoardMemberStatus } from '../domain/types';

function toBoardMember(row: unknown): BoardMember {
  const parsed = boardMemberRowSchema.parse(row);
  return {
    boardId: parsed.board_id,
    userId: parsed.user_id,
    invitedEmail: parsed.invited_email,
    displayName: parsed.display_name,
    editRequested: parsed.edit_requested,
    role: parsed.role,
    status: parsed.status,
  };
}

export async function listMembers(client: SupabaseClient, boardId: string): Promise<BoardMember[]> {
  const { data, error } = await client.from('board_members').select('*').eq('board_id', boardId);
  if (error) throw error;
  return data.map(toBoardMember);
}

export async function isOwner(client: SupabaseClient, boardId: string, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.role === 'owner';
}

export async function addMember(
  client: SupabaseClient,
  member: {
    boardId: string;
    userId: string;
    invitedEmail: string | null;
    role: BoardMemberRole;
    status: BoardMemberStatus;
  }
): Promise<BoardMember> {
  const { data, error } = await client
    .from('board_members')
    .insert({
      board_id: member.boardId,
      user_id: member.userId,
      invited_email: member.invitedEmail,
      role: member.role,
      status: member.status,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toBoardMember(data);
}

export async function updateMemberRole(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  role: 'editor' | 'viewer'
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(client: SupabaseClient, boardId: string, userId: string): Promise<void> {
  const { error } = await client.from('board_members').delete().eq('board_id', boardId).eq('user_id', userId);
  if (error) throw error;
}

export async function getMyRole(client: SupabaseClient, boardId: string): Promise<BoardMemberRole | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from('board_members')
    .select('role')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export async function joinViaShareLink(client: SupabaseClient, token: string): Promise<string> {
  const { data, error } = await client.rpc('join_board_via_token', { token });
  if (error) throw error;
  return data as string;
}

export async function setEditRequested(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  requested: boolean
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ edit_requested: requested })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setDisplayName(
  client: SupabaseClient,
  boardId: string,
  userId: string,
  displayName: string
): Promise<void> {
  const { error } = await client
    .from('board_members')
    .update({ display_name: displayName })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw error;
}
