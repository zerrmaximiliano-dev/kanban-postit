'use client';

import type { Note } from '../domain/types';

const PRIORITY_LABEL: Record<Note['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return (hash % 5) - 2; // -2deg..2deg
}

export function NoteCard({
  note,
  onOpen,
  onDelete,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onDelete?: (note: Note) => void;
}) {
  const doneCount = note.checklist.filter((c) => c.done).length;

  return (
    <div
      onDoubleClick={() => onOpen(note)}
      style={{ backgroundColor: note.color, transform: `rotate(${tiltFor(note.id)}deg)` }}
      className="group relative mb-3 cursor-pointer rounded-[2px] p-3 text-sm shadow-[2px_3px_6px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:shadow-[3px_5px_10px_rgba(0,0,0,0.3)]"
    >
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note);
          }}
          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs leading-none text-gray-800 hover:bg-black/20 group-hover:flex"
          aria-label="Eliminar nota"
        >
          ×
        </button>
      )}

      <p className="pr-4 font-medium text-gray-900">{note.title}</p>

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
