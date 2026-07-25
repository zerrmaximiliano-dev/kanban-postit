import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCard } from './NoteCard';
import type { Note } from '../domain/types';

const note: Note = {
  id: 'n1',
  columnId: 'col1',
  title: 'Llamar al cliente',
  description: '',
  color: '#fff59d',
  priority: 'high',
  tags: ['urgente'],
  dueDate: '2026-07-25',
  order: 0,
  checklist: [
    { id: 'c1', noteId: 'n1', text: 'Preparar agenda', done: true, order: 0 },
    { id: 'c2', noteId: 'n1', text: 'Confirmar horario', done: false, order: 1 },
  ],
};

describe('NoteCard', () => {
  it('renders title, tags, and checklist progress', () => {
    render(<NoteCard note={note} onClick={() => {}} />);

    expect(screen.getByText('Llamar al cliente')).toBeInTheDocument();
    expect(screen.getByText('urgente')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<NoteCard note={note} onClick={onClick} />);

    fireEvent.click(screen.getByText('Llamar al cliente'));
    expect(onClick).toHaveBeenCalledWith(note);
  });
});
