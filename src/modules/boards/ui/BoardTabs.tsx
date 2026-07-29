'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BoardTabs({ boardId }: { boardId: string }) {
  const pathname = usePathname();
  const isCalendar = pathname?.endsWith('/calendar');
  const isGantt = pathname?.endsWith('/gantt');
  const isBoard = !isCalendar && !isGantt;

  return (
    <div className="flex gap-6 border-b border-border bg-surface px-6">
      <Link
        href={`/boards/${boardId}`}
        aria-current={isBoard ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isBoard ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Board
      </Link>
      <Link
        href={`/boards/${boardId}/calendar`}
        aria-current={isCalendar ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isCalendar ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Calendario
      </Link>
      <Link
        href={`/boards/${boardId}/gantt`}
        aria-current={isGantt ? 'page' : undefined}
        className={`border-b-2 py-3 text-sm font-medium transition-colors duration-150 ease-standard ${
          isGantt ? 'border-accent-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
        }`}
      >
        Gantt
      </Link>
    </div>
  );
}
