'use client';

import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { getMonthRange, getMonthLeadingBlankDays } from '@/src/modules/calendar/domain/bucketing';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MoreIcon } from '@/src/modules/ui/icons';
import type { Note } from '../domain/types';

const PANEL_MARGIN = 8;

interface DragState {
  startX: number;
  startY: number;
  originTop: number;
  originLeft: number;
  dragging: boolean;
}

const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function DayDropCell({ date, count }: { date: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `calendar-day:${date}`, data: { type: 'calendar-day', date } });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-control border text-xs transition-[transform,border-color,background-color] duration-150 ease-standard ${
        isOver ? 'scale-110 border-accent-500 bg-accent-100/50' : 'border-border bg-surface'
      }`}
    >
      <span className="text-ink-muted">{date.slice(8, 10)}</span>
      {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />}
    </div>
  );
}

export function MiniCalendarPanel({ notes, accentColor }: { notes: Note[]; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  function handleHeaderPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originTop: rect.top,
      originLeft: rect.left,
      dragging: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleHeaderPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.hypot(dx, dy) < 5) return;
    drag.dragging = true;
    suppressClickRef.current = true;

    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 288;
    const height = panel?.offsetHeight ?? 44;
    const maxLeft = Math.max(window.innerWidth - width - PANEL_MARGIN, PANEL_MARGIN);
    const maxTop = Math.max(window.innerHeight - height - PANEL_MARGIN, PANEL_MARGIN);
    setPosition({
      left: Math.min(Math.max(drag.originLeft + dx, PANEL_MARGIN), maxLeft),
      top: Math.min(Math.max(drag.originTop + dy, PANEL_MARGIN), maxTop),
    });
  }

  function handleHeaderPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleHeaderClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen((o) => !o);
  }

  const range = getMonthRange(cursor.getFullYear(), cursor.getMonth());
  const leadingBlanks = getMonthLeadingBlankDays(cursor.getFullYear(), cursor.getMonth());

  const days: string[] = [];
  for (const d = new Date(range.start); d <= range.end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  function countForDay(date: string): number {
    return notes.filter((n) => n.startDate && n.startDate <= date && (n.endDate ?? n.startDate) >= date).length;
  }

  return (
    <div
      ref={panelRef}
      className={`fixed z-20 w-72 rounded-card bg-surface shadow-elevation-md ${position ? '' : 'bottom-4 right-[22rem]'}`}
      style={position ? { top: position.top, left: position.left } : undefined}
    >
      <button
        type="button"
        onClick={handleHeaderClick}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        className="flex w-full cursor-grab items-center gap-2 rounded-t-card px-3 py-2.5 text-sm font-semibold text-white transition-colors duration-150 ease-standard active:cursor-grabbing"
        style={{ backgroundColor: accentColor }}
        title="Arrastrá para mover, click para abrir/cerrar"
      >
        <MoreIcon className="h-3.5 w-3.5 rotate-90 text-white/60" />
        <CalendarIcon className="h-4 w-4" />
        <span className="flex-1 text-left">Abrí y arrastrá una nota aquí</span>
        <ChevronRightIcon className={`h-4 w-4 transition-transform duration-200 ease-standard ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:bg-page hover:text-ink"
              aria-label="Mes anterior"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <p className="text-xs font-semibold text-ink">
              {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="rounded-control p-1 text-ink-muted transition-colors duration-150 ease-standard hover:bg-page hover:text-ink"
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-[10px] font-bold uppercase text-ink-faint">
                {label}
              </p>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {days.map((date) => (
              <DayDropCell key={date} date={date} count={countForDay(date)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
