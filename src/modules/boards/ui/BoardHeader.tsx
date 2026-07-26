'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard, updateBoardColor } from '../application/boardService';
import { getBoardPalette, BOARD_COLOR_PRESETS } from '../domain/palette';
import { useBoardTheme } from './BoardThemeContext';

export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBoard(supabase, boardId).then((board) => {
      if (!cancelled) {
        setName(board.name);
        setDraft(board.name);
        setColor(board.color);
        setBoardColor(board.color);
      }
    });
    return () => {
      cancelled = true;
      setBoardColor(null);
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

  function handlePickColor(newColor: string) {
    setColor(newColor);
    setBoardColor(newColor);
    setPickerOpen(false);
    updateBoardColor(supabase, boardId, newColor);
  }

  if (name === null) return null;

  const palette = getBoardPalette(color);

  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3"
      style={{ backgroundColor: palette.dark }}
    >
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
          className="rounded border border-white/40 bg-white/10 px-2 py-1 text-xl font-bold text-white"
        />
      ) : (
        <h1
          onClick={() => setEditing(true)}
          className="cursor-text text-xl font-bold text-white"
          title="Click para renombrar el tablero"
        >
          {name}
        </h1>
      )}

      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className="h-6 w-6 rounded-full border-2 border-white/70"
          style={{ backgroundColor: color ?? palette.dark }}
          aria-label="Cambiar color del tablero"
        />
        {pickerOpen && (
          <div className="absolute right-0 top-8 z-10 flex flex-wrap gap-1.5 rounded-lg bg-white p-2 shadow-lg">
            {BOARD_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.color}
                type="button"
                onClick={() => handlePickColor(preset.color)}
                style={{ backgroundColor: preset.color }}
                className="h-6 w-6 rounded-full border border-black/10"
                aria-label={`Color ${preset.name}`}
                title={preset.name}
              />
            ))}
            <input
              type="color"
              value={color ?? '#5B6B8C'}
              onChange={(e) => handlePickColor(e.target.value)}
              aria-label="Color personalizado del tablero"
              className="h-6 w-7 cursor-pointer rounded border border-gray-300 p-0"
            />
          </div>
        )}
      </div>
    </div>
  );
}
