'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { getMonthRange, getMonthLeadingBlankDays } from '@/src/modules/calendar/domain/bucketing';
import type { Note } from '../domain/types';

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
      className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded border text-xs transition ${
        isOver ? 'scale-110 border-sky-400 bg-sky-50' : 'border-gray-200 bg-white'
      }`}
    >
      <span className="text-gray-700">{date.slice(8, 10)}</span>
      {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />}
    </div>
  );
}

export function MiniCalendarPanel({ notes, accentColor }: { notes: Note[]; accentColor: string }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());

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
    <div className="fixed bottom-0 right-4 z-20 w-72 rounded-t-lg bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-t-lg px-3 py-2 text-sm font-bold text-white"
        style={{ backgroundColor: accentColor }}
      >
        <span>📅 Abrí y arrastrá una nota aquí</span>
        <span>{open ? '▾' : '▴'}</span>
      </button>

      {open && (
        <div className="p-2">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="px-1.5 text-gray-500 hover:text-gray-800"
              aria-label="Mes anterior"
            >
              ‹
            </button>
            <p className="text-xs font-medium text-gray-700">
              {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="px-1.5 text-gray-500 hover:text-gray-800"
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="text-center text-[10px] font-bold uppercase text-gray-400">
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
