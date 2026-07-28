// src/modules/boards/application/memberService.ts
'use server';

import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/src/modules/identity/data/supabaseServerClient';
import { createAdminClient } from '@/src/modules/identity/data/supabaseAdminClient';
import * as boardMembersRepo from '../data/boardMembersRepo';
import type { BoardMember, BoardMemberRole } from '../domain/types';

// The Admin API has no "get user by email" call, so an existing user is
// found by listing and filtering. This is O(n) in total user count, which
// is an accepted simplification for this app's expected scale (small
// teams sharing a handful of boards) — revisit if user count grows large.
// listUsers() is paginated (default page size 50), so we page through all
// results — otherwise a user past page 1 would be missed and re-invited.
async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<User | null> {
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

export async function listBoardMembers(boardId: string): Promise<BoardMember[]> {
  const supabase = await createServerSupabaseClient();
  return boardMembersRepo.listMembers(supabase, boardId);
}

export async function inviteMemberByEmail(boardId: string, email: string): Promise<BoardMember> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const callerIsOwner = await boardMembersRepo.isOwner(supabase, boardId, user.id);
  if (!callerIsOwner) throw new Error('Solo el dueño del tablero puede invitar');

  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, email);

  let targetUserId: string;
  let status: 'pending' | 'accepted';

  if (existing) {
    targetUserId = existing.id;
    status = 'accepted';
  } else {
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);
    targetUserId = invited.user.id;
    status = 'pending';
  }

  return boardMembersRepo.addMember(supabase, {
    boardId,
    userId: targetUserId,
    invitedEmail: email,
    role: 'editor',
    status,
  });
}

export async function updateMemberRole(boardId: string, userId: string, role: BoardMemberRole): Promise<void> {
  if (role === 'owner') throw new Error('No se puede reasignar el rol de dueño');
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.updateMemberRole(supabase, boardId, userId, role);
}

export async function removeMember(boardId: string, userId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await boardMembersRepo.removeMember(supabase, boardId, userId);
}
