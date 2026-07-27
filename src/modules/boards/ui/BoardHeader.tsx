'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { getBoard, renameBoard, updateBoardColor } from '../application/boardService';
import { getBoardPalette, BOARD_COLOR_PRESETS } from '../domain/palette';
import { useBoardTheme } from './BoardThemeContext';
import { PaletteIcon } from '@/src/modules/ui/icons';
import { useClickOutside } from '@/src/modules/ui/useClickOutside';

export function BoardHeader({ boardId }: { boardId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { setBoardColor } = useBoardTheme();
  const [name, setName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useClickOutside<HTMLDivElement>(() => setPickerOpen(false));

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
      className="relative flex items-center gap-3 px-6 py-4"
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
          className="rounded-control border border-white/30 bg-white/10 px-2 py-1 text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      ) : (
        <h1
          onClick={() => setEditing(true)}
          className="cursor-text text-2xl font-bold text-white"
          title="Click para renombrar el tablero"
        >
          {name}
        </h1>
      )}

      <div ref={pickerRef} className="relative ml-auto">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-control border border-white/25 bg-white/10 text-white transition-colors duration-150 ease-standard hover:bg-white/20"
          aria-label="Cambiar color del tablero"
          title="Cambiar color del tablero"
        >
          <PaletteIcon />
        </button>
        {pickerOpen && (
          <div className="absolute right-0 top-11 z-10 w-64 rounded-card border border-border bg-surface p-3 shadow-elevation-md">
            <p className="mb-2 text-xs font-medium text-ink-muted">Color del tablero</p>
            <div className="flex flex-wrap gap-2">
              {BOARD_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => handlePickColor(preset.color)}
                  style={{ backgroundColor: preset.color }}
                  className={`h-7 w-7 rounded-full transition-transform duration-150 ease-standard hover:scale-110 ${
                    color === preset.color ? 'ring-2 ring-accent-500 ring-offset-2' : 'ring-1 ring-black/10'
                  }`}
                  aria-label={`Color ${preset.name}`}
                  title={preset.name}
                />
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs font-medium text-ink-muted">
              Personalizado
              <input
                type="color"
                value={color ?? '#1B4B5A'}
                onChange={(e) => handlePickColor(e.target.value)}
                aria-label="Color personalizado del tablero"
                className="h-7 w-9 cursor-pointer rounded-control border border-border p-0"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
