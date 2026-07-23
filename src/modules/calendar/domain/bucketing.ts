// src/modules/calendar/domain/bucketing.ts
import type { Note } from '../../boards/domain/types';

export interface DayBucket {
  date: string; // 'YYYY-MM-DD'
  notes: Note[];
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function bucketNotesByDay(notes: Note[], rangeStart: Date, rangeEnd: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  const cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    const dateStr = toDateString(cursor);
    buckets.push({
      date: dateStr,
      notes: notes.filter((n) => n.dueDate === dateStr),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}
