'use client';

import type { Note } from '../domain/types';

const PRIORITY_LABEL: Record<Note['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function NoteCard({ note, onClick }: { note: Note; onClick: (note: Note) => void }) {
  const doneCount = note.checklist.filter((c) => c.done).length;

  return (
    <div
      onClick={() => onClick(note)}
      style={{ backgroundColor: note.color }}
      className="mb-3 -rotate-1 cursor-pointer rounded-sm p-3 text-sm shadow-md transition hover:-translate-y-0.5"
    >
      <p className="font-medium text-gray-900">{note.title}</p>

      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded bg-black/10 px-1.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between text-xs text-gray-700">
        <span>{PRIORITY_LABEL[note.priority]}</span>
        {note.checklist.length > 0 && (
          <span>
            {doneCount}/{note.checklist.length}
          </span>
        )}
      </div>

      {note.dueDate && <p className="mt-1 text-xs text-gray-600">{note.dueDate}</p>}
    </div>
  );
}
