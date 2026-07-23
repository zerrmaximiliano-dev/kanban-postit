// src/modules/boards/domain/reorder.test.ts
import { describe, it, expect } from 'vitest';
import { reorderWithinColumn, moveNoteToColumn } from './reorder';
import type { Note } from './types';

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    columnId: 'col1',
    title: 'Untitled',
    description: '',
    color: '#fff59d',
    priority: 'medium',
    tags: [],
    dueDate: null,
    order: 0,
    checklist: [],
    ...overrides,
  };
}

describe('reorderWithinColumn', () => {
  it('moves a note to a new position within the same column', () => {
    const notes = [
      makeNote({ id: 'a', order: 0 }),
      makeNote({ id: 'b', order: 1 }),
      makeNote({ id: 'c', order: 2 }),
    ];

    const result = reorderWithinColumn(notes, 'a', 2);

    expect(result.map((n) => n.id)).toEqual(['b', 'c', 'a']);
    expect(result.find((n) => n.id === 'a')?.order).toBe(2);
    expect(result.find((n) => n.id === 'b')?.order).toBe(0);
  });

  it('returns the original array if the note id does not exist', () => {
    const notes = [makeNote({ id: 'a', order: 0 })];
    const result = reorderWithinColumn(notes, 'missing', 0);
    expect(result).toEqual(notes);
  });
});

describe('moveNoteToColumn', () => {
  it('moves a note to a different column at the target index and re-orders both columns', () => {
    const notes = [
      makeNote({ id: 'a', columnId: 'col1', order: 0 }),
      makeNote({ id: 'b', columnId: 'col1', order: 1 }),
      makeNote({ id: 'c', columnId: 'col2', order: 0 }),
    ];

    const result = moveNoteToColumn(notes, 'a', 'col2', 0);

    const moved = result.find((n) => n.id === 'a');
    expect(moved?.columnId).toBe('col2');
    expect(moved?.order).toBe(0);

    const c = result.find((n) => n.id === 'c');
    expect(c?.order).toBe(1);

    const b = result.find((n) => n.id === 'b');
    expect(b?.columnId).toBe('col1');
    expect(b?.order).toBe(0);
  });

  it('returns the original array if the note id does not exist', () => {
    const notes = [makeNote({ id: 'a', columnId: 'col1', order: 0 })];
    const result = moveNoteToColumn(notes, 'missing', 'col2', 0);
    expect(result).toEqual(notes);
  });
});
