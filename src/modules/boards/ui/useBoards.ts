'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { listMyBoards, createBoardWithDefaults } from '../application/boardService';

export function useBoards() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['boards'],
    queryFn: () => listMyBoards(supabase),
  });
}

export function useCreateBoard() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      return createBoardWithDefaults(supabase, name, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
