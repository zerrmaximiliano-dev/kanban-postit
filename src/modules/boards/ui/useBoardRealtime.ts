// src/modules/boards/ui/useBoardRealtime.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoardColumns } from '../application/boardService';
import { loadBoardNotes } from '../application/noteService';
import { columnRowSchema, noteRowSchema, checklistItemRowSchema } from '../data/schemas';
import type { Column, Note } from '../domain/types';

type Row = Record<string, unknown>;

function columnFromRow(row: Row): Column {
  const parsed = columnRowSchema.parse(row);
  return { id: parsed.id, boardId: parsed.board_id, name: parsed.name, order: parsed.order };
}

function noteFromRow(row: Row, checklist: Note['checklist']): Note {
  const parsed = noteRowSchema.parse(row);
  return {
    id: parsed.id,
    columnId: parsed.column_id,
    title: parsed.title,
    description: parsed.description,
    color: parsed.color,
    priority: parsed.priority,
    tags: parsed.tags,
    startDate: parsed.start_date,
    endDate: parsed.end_date,
    order: parsed.order,
    checklist,
  };
}

export function useBoardRealtime(boardId: string) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const columnIdsRef = useRef<Set<string>>(new Set());
  const noteIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    columnIdsRef.current = new Set(columns.map((c) => c.id));
  }, [columns]);

  useEffect(() => {
    noteIdsRef.current = new Set(notes.map((n) => n.id));
  }, [notes]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const cols = await getBoardColumns(supabase, boardId);
      const loadedNotes = await loadBoardNotes(supabase, cols.map((c) => c.id));
      if (cancelled) return;
      setColumns(cols);
      setNotes(loadedNotes);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: `board_id=eq.${boardId}` },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            setColumns((prev) => prev.filter((c) => c.id !== oldId));
            return;
          }
          const column = columnFromRow(payload.new as Row);
          setColumns((prev) =>
            prev.some((c) => c.id === column.id)
              ? prev.map((c) => (c.id === column.id ? column : c))
              : [...prev, column]
          );
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            if (!oldId || !noteIdsRef.current.has(oldId)) return;
            setNotes((prev) => prev.filter((n) => n.id !== oldId));
            return;
          }
          const row = payload.new as Row;
          const columnId = row.column_id as string;
          const noteId = row.id as string;
          if (!columnIdsRef.current.has(columnId) && !noteIdsRef.current.has(noteId)) return;
          setNotes((prev) => {
            const existing = prev.find((n) => n.id === noteId);
            const note = noteFromRow(row, existing?.checklist ?? []);
            return existing ? prev.map((n) => (n.id === noteId ? note : n)) : [...prev, note];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items' },
        (payload: RealtimePostgresChangesPayload<Row>) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string; note_id?: string };
            if (!oldRow.note_id || !noteIdsRef.current.has(oldRow.note_id)) return;
            setNotes((prev) =>
              prev.map((n) =>
                n.id === oldRow.note_id
                  ? { ...n, checklist: n.checklist.filter((c) => c.id !== oldRow.id) }
                  : n
              )
            );
            return;
          }
          const parsed = checklistItemRowSchema.parse(payload.new);
          if (!noteIdsRef.current.has(parsed.note_id)) return;
          const item = { id: parsed.id, noteId: parsed.note_id, text: parsed.text, done: parsed.done, order: parsed.order };
          setNotes((prev) =>
            prev.map((n) => {
              if (n.id !== item.noteId) return n;
              const exists = n.checklist.some((c) => c.id === item.id);
              return {
                ...n,
                checklist: exists
                  ? n.checklist.map((c) => (c.id === item.id ? item : c))
                  : [...n.checklist, item],
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [boardId]);

  return { columns, notes, setColumns, setNotes, loading };
}
