// src/modules/boards/domain/gantt.test.ts
import { describe, it, expect } from 'vitest';
import {
  shiftDate,
  daysBetween,
  computeDateRange,
  computeBarLayout,
  groupDatedNotesByColumn,
  hasConflict,
  computeTimelineSegments,
  wouldCreateCycle,
} from './gantt';
import type { Column, Note, NoteDependency } from './types';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    columnId: 'col1',
    title: 'Untitled',
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    startDate: null,
    endDate: null,
    order: 0,
    checklist: [],
    ...overrides,
  };
}

function makeColumn(overrides: Partial<Column>): Column {
  return { id: 'col1', boardId: 'board1', name: 'To Do', order: 0, ...overrides };
}

describe('shiftDate', () => {
  it('adds days across a month boundary', () => {
    expect(shiftDate('2026-07-30', 3)).toBe('2026-08-02');
  });

  it('subtracts days', () => {
    expect(shiftDate('2026-07-05', -10)).toBe('2026-06-25');
  });
});

describe('daysBetween', () => {
  it('returns the number of days from one date to another', () => {
    expect(daysBetween('2026-07-01', '2026-07-05')).toBe(4);
  });

  it('returns a negative number when the second date is earlier', () => {
    expect(daysBetween('2026-07-05', '2026-07-01')).toBe(-4);
  });
});

describe('computeDateRange', () => {
  it('returns null when no notes have a startDate', () => {
    const notes = [makeNote({ startDate: null })];
    expect(computeDateRange(notes)).toBeNull();
  });

  it('spans from the earliest start to the latest end, with a margin', () => {
    const notes = [
      makeNote({ id: 'a', startDate: '2026-07-10', endDate: '2026-07-12' }),
      makeNote({ id: 'b', startDate: '2026-07-01', endDate: null }),
    ];
    const range = computeDateRange(notes);
    expect(range).toEqual({ start: '2026-06-28', end: '2026-07-15' });
  });
});

describe('computeBarLayout', () => {
  it('positions a single-day note (no endDate) at 1 day of width', () => {
    const note = makeNote({ startDate: '2026-07-05', endDate: null });
    const layout = computeBarLayout(note, '2026-07-01', 'day');
    expect(layout).toEqual({ left: 4 * 56, width: 56 });
  });

  it('returns null for a note with no startDate', () => {
    const note = makeNote({ startDate: null });
    expect(computeBarLayout(note, '2026-07-01', 'day')).toBeNull();
  });

  it('widens a multi-day note proportionally to zoom', () => {
    const note = makeNote({ startDate: '2026-07-01', endDate: '2026-07-03' });
    const layout = computeBarLayout(note, '2026-07-01', 'day');
    expect(layout).toEqual({ left: 0, width: 3 * 56 });
  });

  it('clamps width to the minimum when endDate is before startDate', () => {
    const note = makeNote({ startDate: '2026-07-05', endDate: '2026-07-01' });
    const layout = computeBarLayout(note, '2026-07-01', 'day');
    expect(layout).toEqual({ left: 4 * 56, width: 12 });
  });
});

describe('groupDatedNotesByColumn', () => {
  it('groups only dated notes by column, in column order', () => {
    const columns = [makeColumn({ id: 'col1', order: 0 }), makeColumn({ id: 'col2', order: 1 })];
    const notes = [
      makeNote({ id: 'a', columnId: 'col1', startDate: '2026-07-01', order: 1 }),
      makeNote({ id: 'b', columnId: 'col1', startDate: '2026-07-02', order: 0 }),
      makeNote({ id: 'c', columnId: 'col2', startDate: null }),
    ];
    const groups = groupDatedNotesByColumn(columns, notes);
    expect(groups).toHaveLength(1);
    expect(groups[0].column.id).toBe('col1');
    expect(groups[0].notes.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

describe('hasConflict', () => {
  it('is true when a note starts before its predecessor ends', () => {
    const predecessor = makeNote({ id: 'p', startDate: '2026-07-01', endDate: '2026-07-05' });
    const successor = makeNote({ id: 's', startDate: '2026-07-03' });
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'p', successorNoteId: 's' }];
    const notesById = new Map([
      ['p', predecessor],
      ['s', successor],
    ]);
    expect(hasConflict(successor, deps, notesById)).toBe(true);
  });

  it('is false when the note starts after its predecessor ends', () => {
    const predecessor = makeNote({ id: 'p', startDate: '2026-07-01', endDate: '2026-07-05' });
    const successor = makeNote({ id: 's', startDate: '2026-07-06' });
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'p', successorNoteId: 's' }];
    const notesById = new Map([
      ['p', predecessor],
      ['s', successor],
    ]);
    expect(hasConflict(successor, deps, notesById)).toBe(false);
  });

  it('is false when the note has no dependencies', () => {
    const note = makeNote({ id: 's', startDate: '2026-07-06' });
    expect(hasConflict(note, [], new Map())).toBe(false);
  });
});

describe('computeTimelineSegments', () => {
  it('produces one segment per day at day zoom', () => {
    const segments = computeTimelineSegments('2026-07-01', '2026-07-03', 'day');
    expect(segments).toEqual([
      { label: '01', startOffsetDays: 0, widthDays: 1 },
      { label: '02', startOffsetDays: 1, widthDays: 1 },
      { label: '03', startOffsetDays: 2, widthDays: 1 },
    ]);
  });

  it('produces 7-day segments at week zoom', () => {
    const segments = computeTimelineSegments('2026-07-01', '2026-07-10', 'week');
    expect(segments).toEqual([
      { label: 'Sem 01/07', startOffsetDays: 0, widthDays: 7 },
      { label: 'Sem 08/07', startOffsetDays: 7, widthDays: 3 },
    ]);
  });

  it('splits by calendar month at month zoom', () => {
    const segments = computeTimelineSegments('2026-07-25', '2026-08-05', 'month');
    expect(segments).toEqual([
      { label: 'Jul 2026', startOffsetDays: 0, widthDays: 7 },
      { label: 'Ago 2026', startOffsetDays: 7, widthDays: 5 },
    ]);
  });

  it('produces a full-month segment when the range starts on the 1st', () => {
    const segments = computeTimelineSegments('2026-09-01', '2026-09-30', 'month');
    expect(segments).toEqual([{ label: 'Sep 2026', startOffsetDays: 0, widthDays: 30 }]);
  });

  it('produces a single segment for a range entirely within one month', () => {
    const segments = computeTimelineSegments('2026-09-10', '2026-09-20', 'month');
    expect(segments).toEqual([{ label: 'Sep 2026', startOffsetDays: 0, widthDays: 11 }]);
  });
});

describe('wouldCreateCycle', () => {
  it('is true for a note depending on itself', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true);
  });

  it('is false with no existing dependencies', () => {
    expect(wouldCreateCycle([], 'a', 'b')).toBe(false);
  });

  it('is true for a direct 2-cycle (B already depends on A, now linking A depends on B)', () => {
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'b', successorNoteId: 'a' }];
    expect(wouldCreateCycle(deps, 'a', 'b')).toBe(true);
  });

  it('is true for an indirect cycle through a longer chain (A -> B -> C, now linking C -> A)', () => {
    const deps: NoteDependency[] = [
      { id: 'd1', predecessorNoteId: 'a', successorNoteId: 'b' },
      { id: 'd2', predecessorNoteId: 'b', successorNoteId: 'c' },
    ];
    expect(wouldCreateCycle(deps, 'c', 'a')).toBe(true);
  });

  it('is false for a valid new link that does not close a loop', () => {
    const deps: NoteDependency[] = [{ id: 'd1', predecessorNoteId: 'a', successorNoteId: 'b' }];
    expect(wouldCreateCycle(deps, 'a', 'c')).toBe(false);
  });
});
