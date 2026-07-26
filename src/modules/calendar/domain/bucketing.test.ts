// src/modules/calendar/domain/bucketing.test.ts
import { describe, it, expect } from 'vitest';
import { bucketNotesByDay, getMonthRange, getWeekRange } from './bucketing';
import type { Note } from '../../boards/domain/types';

function makeNote(id: string, startDate: string | null, endDate: string | null = null): Note {
  return {
    id,
    columnId: 'col1',
    title: id,
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    startDate,
    endDate,
    order: 0,
    checklist: [],
  };
}

describe('getMonthRange', () => {
  it('returns first and last day of February in a leap year', () => {
    const { start, end } = getMonthRange(2024, 1); // month is 0-indexed: 1 = February
    expect(start.toISOString().slice(0, 10)).toBe('2024-02-01');
    expect(end.toISOString().slice(0, 10)).toBe('2024-02-29');
  });
});

describe('getWeekRange', () => {
  it('returns Monday through Sunday for a Wednesday date', () => {
    const wednesday = new Date('2026-07-22T00:00:00'); // a Wednesday
    const { start, end } = getWeekRange(wednesday);
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-26');
  });

  it('treats Sunday as the end of the previous week, not the start of a new one', () => {
    const sunday = new Date('2026-07-26T00:00:00');
    const { start, end } = getWeekRange(sunday);
    expect(start.toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(end.toISOString().slice(0, 10)).toBe('2026-07-26');
  });
});

describe('bucketNotesByDay', () => {
  it('groups notes into the bucket matching their startDate when there is no endDate', () => {
    const notes = [
      makeNote('a', '2026-07-20'),
      makeNote('b', '2026-07-20'),
      makeNote('c', '2026-07-22'),
      makeNote('d', null),
    ];

    const buckets = bucketNotesByDay(notes, new Date('2026-07-20'), new Date('2026-07-22'));

    expect(buckets).toHaveLength(3);
    expect(buckets[0].date).toBe('2026-07-20');
    expect(buckets[0].notes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(buckets[2].date).toBe('2026-07-22');
    expect(buckets[2].notes.map((n) => n.id)).toEqual(['c']);
  });

  it('places a multi-day note in every bucket within its start/end range', () => {
    const notes = [makeNote('e', '2026-07-20', '2026-07-22')];

    const buckets = bucketNotesByDay(notes, new Date('2026-07-19'), new Date('2026-07-23'));

    expect(buckets.map((b) => b.notes.map((n) => n.id))).toEqual([[], ['e'], ['e'], ['e'], []]);
  });
});
