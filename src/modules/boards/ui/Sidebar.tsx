'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useBoards, useCreateBoard } from './useBoards';

export function Sidebar() {
  const { data: boards, isLoading } = useBoards();
  const createBoard = useCreateBoard();
  const pathname = usePathname();
  const [newBoardName, setNewBoardName] = useState('');

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    createBoard.mutate(newBoardName.trim());
    setNewBoardName('');
  }

  return (
    <aside className="flex h-screen w-56 flex-col gap-2 bg-gray-800 p-3 text-white">
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-gray-400">
        Tableros
      </h2>

      {isLoading && <p className="px-1 text-sm text-gray-400">Cargando...</p>}

      <nav className="flex flex-col gap-1">
        {boards?.map((board) => {
          const isActive = pathname?.startsWith(`/boards/${board.id}`);
          return (
            <Link
              key={board.id}
              href={`/boards/${board.id}`}
              className={`rounded px-2 py-1.5 text-sm ${
                isActive ? 'bg-purple-600' : 'hover:bg-gray-700'
              }`}
            >
              {board.name}
            </Link>
          );
        })}
      </nav>

      <form onSubmit={handleCreate} className="mt-auto flex flex-col gap-1">
        <input
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Nuevo tablero..."
          className="rounded bg-gray-700 px-2 py-1.5 text-sm placeholder-gray-400"
        />
        <button type="submit" className="rounded bg-purple-600 px-2 py-1.5 text-sm">
          + Crear tablero
        </button>
      </form>
    </aside>
  );
}
