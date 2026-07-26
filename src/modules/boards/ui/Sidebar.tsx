'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useBoards, useCreateBoard, useDeleteBoard } from './useBoards';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import type { Board } from '../domain/types';

export function Sidebar() {
  const { data: boards, isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();
  const pathname = usePathname();
  const router = useRouter();
  const { boardColor } = useBoardTheme();
  const [newBoardName, setNewBoardName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    createBoard.mutate(name, {
      onSuccess: () => setNewBoardName(''),
    });
  }

  function handleDelete(board: Board) {
    if (!window.confirm(`¿Eliminar el tablero "${board.name}" y todo su contenido? Esta acción no se puede deshacer.`)) {
      return;
    }
    deleteBoard.mutate(board.id, {
      onSuccess: () => {
        if (pathname?.startsWith(`/boards/${board.id}`)) {
          router.push('/boards');
        }
      },
    });
  }

  const background = boardColor ? getBoardPalette(boardColor).medium : undefined;

  if (collapsed) {
    return (
      <aside
        className={`flex h-screen w-10 flex-col items-center p-2 text-white ${background ? '' : 'bg-gray-800'}`}
        style={background ? { backgroundColor: background } : undefined}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded px-1.5 py-1 text-sm hover:bg-white/10"
          aria-label="Mostrar barra lateral"
        >
          »
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`flex h-screen w-56 flex-col gap-2 p-3 text-white ${background ? '' : 'bg-gray-800'}`}
      style={background ? { backgroundColor: background } : undefined}
    >
      <div className="flex items-center justify-between">
        <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-gray-400">Tableros</h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded px-1.5 py-1 text-sm hover:bg-white/10"
          aria-label="Ocultar barra lateral"
        >
          «
        </button>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-1">
        <input
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Nuevo tablero..."
          className="rounded bg-white/10 px-2 py-1.5 text-sm placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={createBoard.isPending}
          className="rounded bg-purple-600 px-2 py-1.5 text-sm disabled:opacity-50"
        >
          {createBoard.isPending ? 'Creando...' : '+ Crear tablero'}
        </button>
        {createBoard.isError && (
          <p className="text-xs text-red-400">
            No se pudo crear el tablero. Intentá de nuevo.
          </p>
        )}
      </form>

      {isLoading && <p className="px-1 text-sm text-gray-400">Cargando...</p>}

      <nav className="flex flex-col gap-1 overflow-y-auto">
        {boards?.map((board) => {
          const isActive = pathname?.startsWith(`/boards/${board.id}`);
          return (
            <div
              key={board.id}
              className={`group flex items-center rounded ${isActive ? 'bg-white/20' : 'hover:bg-white/10'}`}
            >
              <Link href={`/boards/${board.id}`} className="flex-1 px-2 py-1.5 text-sm">
                {board.name}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(board)}
                className="hidden px-2 text-gray-300 hover:text-red-400 group-hover:block"
                aria-label={`Eliminar tablero ${board.name}`}
              >
                🗑
              </button>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
