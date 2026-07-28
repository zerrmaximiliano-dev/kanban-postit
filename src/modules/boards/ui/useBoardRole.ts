'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getMyRole } from '../data/boardMembersRepo';
import type { BoardMemberRole } from '../domain/types';

export function useBoardRole(boardId: string) {
  const [role, setRole] = useState<BoardMemberRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    getMyRole(supabase, boardId).then((r) => {
      if (!cancelled) setRole(r);
    });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const canEdit = role === 'owner' || role === 'editor';

  return { role, canEdit };
}
