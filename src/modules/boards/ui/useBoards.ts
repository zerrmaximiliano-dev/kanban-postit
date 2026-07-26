'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { listMyBoards, createBoardWithDefaults, deleteBoard } from '../application/boardService';

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
    onError: (error) => {
      console.error('Failed to create board:', error);
    },
  });
}

export function useDeleteBoard() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(supabase, boardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    onError: (error) => {
      console.error('Failed to delete board:', error);
    },
  });
}
