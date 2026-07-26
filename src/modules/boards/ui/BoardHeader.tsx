'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard } from '../application/boardService';

export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBoard(supabase, boardId).then((board) => {
      if (!cancelled) {
        setName(board.name);
        setDraft(board.name);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  function commitRename() {
    setEditing(false);
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name ?? '');
      return;
    }
    setName(trimmed);
    renameBoard(supabase, boardId, trimmed).then(() => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    });
  }

  if (name === null) return null;

  return (
    <div className="border-b border-gray-200 bg-white px-4 pt-3">
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="rounded border border-purple-300 px-2 py-1 text-xl font-bold text-gray-900"
        />
      ) : (
        <h1
          onClick={() => setEditing(true)}
          className="cursor-text text-xl font-bold text-gray-900"
          title="Click para renombrar el tablero"
        >
          {name}
        </h1>
      )}
    </div>
  );
}
