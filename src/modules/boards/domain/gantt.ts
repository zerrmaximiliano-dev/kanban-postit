// src/modules/boards/domain/gantt.ts
import type { Column, Note, NoteDependency } from './types';

export type GanttZoom = 'day' | 'week' | 'month';

const PX_PER_DAY: Record<GanttZoom, number> = {
  day: 56,
  week: 20,
  month: 6,
};

export function pxPerDayForZoom(zoom: GanttZoom): number {
  return PX_PER_DAY[zoom];
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
}

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseDate(fromDateStr);
  const to = parseDate(toDateStr);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

const RANGE_MARGIN_DAYS = 3;

export function computeDateRange(notes: Note[]): { start: string; end: string } | null {
  const dated = notes.filter((n) => n.startDate !== null);
  if (dated.length === 0) return null;

  let minStart = dated[0].startDate as string;
  let maxEnd = dated[0].endDate ?? (dated[0].startDate as string);

  for (const note of dated) {
    const start = note.startDate as string;
    const end = note.endDate ?? start;
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
  }

  return {
    start: shiftDate(minStart, -RANGE_MARGIN_DAYS),
    end: shiftDate(maxEnd, RANGE_MARGIN_DAYS),
  };
}

export interface BarLayout {
  left: number;
  width: number;
}

const MIN_BAR_WIDTH_PX = 12;

export function computeBarLayout(note: Note, rangeStart: string, zoom: GanttZoom): BarLayout | null {
  if (!note.startDate) return null;
  const pxPerDay = pxPerDayForZoom(zoom);
  const end = note.endDate ?? note.startDate;
  const left = daysBetween(rangeStart, note.startDate) * pxPerDay;
  const durationDays = daysBetween(note.startDate, end) + 1;
  const width = Math.max(durationDays * pxPerDay, MIN_BAR_WIDTH_PX);
  return { left, width };
}

export interface GanttGroup {
  column: Column;
  notes: Note[];
}

export function groupDatedNotesByColumn(columns: Column[], notes: Note[]): GanttGroup[] {
  const dated = notes.filter((n) => n.startDate !== null);
  return columns
    .map((column) => ({
      column,
      notes: dated.filter((n) => n.columnId === column.id).sort((a, b) => a.order - b.order),
    }))
    .filter((group) => group.notes.length > 0);
}

export function hasConflict(note: Note, dependencies: NoteDependency[], notesById: Map<string, Note>): boolean {
  if (!note.startDate) return false;
  const predecessorIds = dependencies
    .filter((d) => d.successorNoteId === note.id)
    .map((d) => d.predecessorNoteId);

  return predecessorIds.some((predId) => {
    const predecessor = notesById.get(predId);
    if (!predecessor?.startDate) return false;
    const predecessorEnd = predecessor.endDate ?? predecessor.startDate;
    return note.startDate! < predecessorEnd;
  });
}

// Detects whether inserting predecessorNoteId -> successorNoteId would close
// a cycle, given the dependency edges that already exist. True if
// successorNoteId can already reach predecessorNoteId by following existing
// edges forward (or if they're the same note) — adding the new edge would
// complete a loop.
export function wouldCreateCycle(
  dependencies: NoteDependency[],
  predecessorNoteId: string,
  successorNoteId: string
): boolean {
  if (predecessorNoteId === successorNoteId) return true;

  const adjacency = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = adjacency.get(dep.predecessorNoteId);
    if (list) {
      list.push(dep.successorNoteId);
    } else {
      adjacency.set(dep.predecessorNoteId, [dep.successorNoteId]);
    }
  }

  const visited = new Set<string>();
  const stack = [successorNoteId];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (current === predecessorNoteId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }
  return false;
}

export interface TimelineSegment {
  label: string;
  startOffsetDays: number;
  widthDays: number;
}

const MONTH_LABELS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export function computeTimelineSegments(rangeStart: string, rangeEnd: string, zoom: GanttZoom): TimelineSegment[] {
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;
  const segments: TimelineSegment[] = [];

  if (zoom === 'day') {
    for (let i = 0; i < totalDays; i++) {
      const date = shiftDate(rangeStart, i);
      segments.push({ label: date.slice(8, 10), startOffsetDays: i, widthDays: 1 });
    }
    return segments;
  }

  if (zoom === 'week') {
    let offset = 0;
    while (offset < totalDays) {
      const widthDays = Math.min(7, totalDays - offset);
      const weekStart = shiftDate(rangeStart, offset);
      segments.push({
        label: `Sem ${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`,
        startOffsetDays: offset,
        widthDays,
      });
      offset += 7;
    }
    return segments;
  }

  let offset = 0;
  while (offset < totalDays) {
    const segmentStart = shiftDate(rangeStart, offset);
    const year = Number(segmentStart.slice(0, 4));
    const month = Number(segmentStart.slice(5, 7)) - 1;
    const dayOfMonth = Number(segmentStart.slice(8, 10));
    const daysInThisMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const widthDays = Math.min(daysInThisMonth - dayOfMonth + 1, totalDays - offset);
    segments.push({ label: `${MONTH_LABELS_SHORT[month]} ${year}`, startOffsetDays: offset, widthDays });
    offset += widthDays;
  }
  return segments;
}
