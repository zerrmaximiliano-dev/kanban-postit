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
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start, end };
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  // Read the calendar date using LOCAL getters, since callers may construct
  // `date` from a local-time string (e.g. 'YYYY-MM-DDTHH:mm:ss' with no
  // timezone). We then rebuild start/end as UTC-midnight Date objects so
  // that .toISOString() reads back the intended calendar date regardless
  // of the host machine's timezone. Week starts on Sunday.
  const day = date.getDay(); // 0 = Sunday (local)
  const start = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - day));
  const end = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate() - day + 6));
  return { start, end };
}

/** Weekday index (0 = Sunday) of the 1st of the given month, for aligning the month grid. */
export function getMonthLeadingBlankDays(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 1)).getUTCDay();
}

function noteSpansDate(note: Note, dateStr: string): boolean {
  if (!note.startDate) return false;
  const end = note.endDate ?? note.startDate;
  return dateStr >= note.startDate && dateStr <= end;
}

export function bucketNotesByDay(notes: Note[], rangeStart: Date, rangeEnd: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  const cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    const dateStr = toDateString(cursor);
    buckets.push({
      date: dateStr,
      notes: notes.filter((n) => noteSpansDate(n, dateStr)),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return buckets;
}
