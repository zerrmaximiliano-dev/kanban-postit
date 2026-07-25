'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BoardTabs({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname?.endsWith('/calendar');

  return (
    <div className="flex gap-1 border-b px-4 pt-3">
      <Link
        href={`/boards/${boardId}`}
        className={`rounded-t px-3 py-1.5 text-sm ${!isCalendar ? 'bg-white font-medium' : 'text-gray-500'}`}
      >
        Board
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        className={`rounded-t px-3 py-1.5 text-sm ${isCalendar ? 'bg-white font-medium' : 'text-gray-500'}`}
      >
        Calendario
      </Link>
    </div>
  );
}
