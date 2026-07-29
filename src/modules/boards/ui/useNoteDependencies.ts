// src/modules/boards/ui/useNoteDependencies.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { listDependencies } from '../application/noteDependencyService';
import { noteDependencyRowSchema } from '../data/schemas';
import type { NoteDependency } from '../domain/types';

type Row = Record<string, unknown>;

function fromRow(row: Row): NoteDependency {
  const parsed = noteDependencyRowSchema.parse(row);
  return {
    id: parsed.id,
    predecessorNoteId: parsed.predecessor_note_id,
    successorNoteId: parsed.successor_note_id,
  };
}

export function useNoteDependencies(boardId: string, noteIds: string[]) {
  const [dependencies, setDependencies] = useState<NoteDependency[]>([]);
  const noteIdsRef = useRef<Set<string>>(new Set());
  const noteIdsKey = noteIds.join(',');

  useEffect(() => {
    noteIdsRef.current = new Set(noteIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey]);

  useEffect(() => {
    if (noteIds.length === 0) {
      setDependencies([]);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    listDependencies(supabase, noteIds).then((deps) => {
      if (!cancelled) setDependencies(deps);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`note-dependencies:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_dependencies' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId) return;
            setDependencies((prev) => prev.filter((d) => d.id !== oldId));
            return;
          }
          const row = payload.new as Row;
          const predecessorId = row.predecessor_note_id as string;
          if (!noteIdsRef.current.has(predecessorId)) return;
          const dep = fromRow(row);
          setDependencies((prev) => (prev.some((d) => d.id === dep.id) ? prev : [...prev, dep]));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return { dependencies, setDependencies };
}
