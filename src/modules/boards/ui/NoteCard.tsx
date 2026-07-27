'use client';

import type { Note } from '../domain/types';
import { TrashIcon } from '@/src/modules/ui/icons';

const PRIORITY_LABEL: Record<Note['priority'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const PRIORITY_DOT: Record<Note['priority'], string> = {
  low: 'bg-ink-faint',
  medium: 'bg-warning',
  high: 'bg-danger',
};

const TILT_ANGLES = [-3, -1.5, 0, 1.5, 3];

function tiltFor(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TILT_ANGLES[Math.abs(hash) % TILT_ANGLES.length];
}

export function NoteCard({
  note,
  onOpen,
  onDelete,
  deleteLabel = 'Eliminar nota',
}: {
  note: Note;
  onOpen: (note: Note) => void;
  onDelete?: (note: Note) => void;
  deleteLabel?: string;
}) {
  const doneCount = note.checklist.filter((c) => c.done).length;
  const progress = note.checklist.length > 0 ? (doneCount / note.checklist.length) * 100 : 0;

  return (
    <div
      onDoubleClick={() => onOpen(note)}
      style={{ backgroundColor: note.color, transform: `rotate(${tiltFor(note.id)}deg)` }}
      className="group relative mb-3 cursor-pointer rounded-[2px] p-3 text-sm shadow-elevation-sm transition-[transform,box-shadow] duration-150 ease-standard hover:-translate-y-0.5 hover:shadow-elevation-md"
    >
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note);
          }}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-ink opacity-0 transition-opacity duration-150 ease-standard hover:bg-black/20 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </button>
      )}

      <p className="font-note pr-4 text-lg font-bold leading-tight text-gray-900">{note.title}</p>

      {note.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-black/10 px-1.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-700">
        <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[note.priority]}`} />
        <span>{PRIORITY_LABEL[note.priority]}</span>
      </div>

      {note.checklist.length > 0 && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-black/40 transition-[width] duration-200 ease-standard"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-700">
            {doneCount}/{note.checklist.length} tareas
          </p>
        </div>
      )}

      {note.startDate && (
        <p className="mt-1 text-xs text-gray-600">
          {note.startDate}
          {note.endDate && note.endDate !== note.startDate ? ` → ${note.endDate}` : ''}
        </p>
      )}
    </div>
  );
}
