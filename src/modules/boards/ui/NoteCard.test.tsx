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
  startDate: '2026-07-25',
  endDate: null,
  order: 0,
  checklist: [
    { id: 'c1', noteId: 'n1', text: 'Preparar agenda', done: true, order: 0 },
    { id: 'c2', noteId: 'n1', text: 'Confirmar horario', done: false, order: 1 },
  ],
};

describe('NoteCard', () => {
  it('renders title, tags, and checklist progress', () => {
    render(<NoteCard note={note} onOpen={() => {}} />);

    expect(screen.getByText('Llamar al cliente')).toBeInTheDocument();
    expect(screen.getByText('urgente')).toBeInTheDocument();
    expect(screen.getByText('1/2 tareas')).toBeInTheDocument();
  });

  it('calls onOpen when double-clicked', () => {
    const onOpen = vi.fn();
    render(<NoteCard note={note} onOpen={onOpen} />);

    fireEvent.doubleClick(screen.getByText('Llamar al cliente'));
    expect(onOpen).toHaveBeenCalledWith(note);
  });

  it('calls onDelete when the delete button is clicked, without triggering onOpen', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<NoteCard note={note} onOpen={onOpen} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('Eliminar nota'));
    expect(onDelete).toHaveBeenCalledWith(note);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
