'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/src/modules/identity/data/supabaseClient';
import { useBoards, useCreateBoard, useDeleteBoard } from './useBoards';
import { useBoardTheme } from './BoardThemeContext';
import { getBoardPalette } from '../domain/palette';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';
import { useToast } from '@/src/modules/ui/Toast';
import { ChevronsLeftIcon, ChevronsRightIcon, LogOutIcon, TrashIcon } from '@/src/modules/ui/icons';
import type { Board } from '../domain/types';

export function Sidebar() {
  const { data: boards, isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();
  const pathname = usePathname();
  const router = useRouter();
  const { boardColor } = useBoardTheme();
  const { showToast } = useToast();
  const [newBoardName, setNewBoardName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newBoardName.trim();
    if (!name) return;
    createBoard.mutate(name, {
      onSuccess: () => {
        setNewBoardName('');
        showToast('Tablero creado');
      },
      onError: () => showToast('No se pudo crear el tablero', 'danger'),
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
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

  const background = boardColor ? getBoardPalette(boardColor).dark : '#1B4B5A';

  if (collapsed) {
    return (
      <aside
        className="flex h-screen w-12 shrink-0 flex-col items-center gap-3 py-4 text-white"
        style={{ background: `linear-gradient(180deg, ${background}, color-mix(in srgb, ${background} 80%, black))` }}
      >
        <img src="/janus-icon.png" alt="Janus" className="h-6 w-6 object-contain" />
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-control p-1.5 text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
          aria-label="Mostrar barra lateral"
        >
          <ChevronsRightIcon />
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="mt-auto rounded-control p-1.5 text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOutIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col gap-4 p-4 text-white"
      style={{ background: `linear-gradient(180deg, ${background}, color-mix(in srgb, ${background} 80%, black))` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/janus-icon.png" alt="Janus" className="h-6 w-6 object-contain" />
          <div>
            <p className="text-sm font-semibold leading-tight text-white">Janus</p>
            <h2 className="text-xs font-bold uppercase tracking-wide text-white/70">Tableros</h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-control p-1.5 text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
          aria-label="Ocultar barra lateral"
        >
          <ChevronsLeftIcon />
        </button>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2">
        <Input
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Nuevo tablero..."
          className="border-white/15 bg-white/10 text-white placeholder-white/50 focus:border-accent-500 focus:ring-accent-500/30"
        />
        <Button type="submit" loading={createBoard.isPending} disabled={createBoard.isPending}>
          {createBoard.isPending ? 'Creando...' : 'Crear tablero'}
        </Button>
      </form>

      {isLoading && <p className="px-1 text-sm text-white/70">Cargando...</p>}

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {boards?.map((board) => {
          const isActive = pathname?.startsWith(`/boards/${board.id}`);
          return (
            <div
              key={board.id}
              className={`group flex items-center rounded-control transition-colors duration-150 ease-standard ${
                isActive ? 'bg-white/15' : 'hover:bg-white/10'
              }`}
              style={isActive ? { boxShadow: 'inset 3px 0 0 0 var(--color-accent-500)' } : undefined}
            >
              <Link href={`/boards/${board.id}`} className="flex-1 truncate px-3 py-2 text-sm">
                {board.name}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(board)}
                className="flex px-2 text-white/70 opacity-0 transition-opacity duration-150 ease-standard hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100"
                aria-label={`Eliminar tablero ${board.name}`}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center gap-2 rounded-control px-3 py-2 text-sm text-white/70 transition-colors duration-150 ease-standard hover:bg-white/10 hover:text-white"
      >
        <LogOutIcon className="h-4 w-4" />
        Cerrar sesión
      </button>
    </aside>
  );
}
