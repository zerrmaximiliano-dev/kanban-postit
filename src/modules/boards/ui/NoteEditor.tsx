'use client';

import { useState } from 'react';
import type { Note, Priority } from '../domain/types';

const COLORS = ['#FDE8C8', '#FBD4D4', '#D6ECD2', '#CFE3F5', '#E6D9F2', '#FCF4CB'];

export function NoteEditor({
  note,
  onClose,
  onSave,
  onDelete,
}: {
  note: Note;
  onClose: () => void;
  onSave: (update: {
    title: string;
    description: string;
    color: string;
    priority: Priority;
    tags: string[];
    dueDate: string | null;
  }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [color, setColor] = useState(note.color);
  const [priority, setPriority] = useState<Priority>(note.priority);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [dueDate, setDueDate] = useState(note.dueDate ?? '');

  function handleSave() {
    onSave({
      title: title.trim(),
      description,
      color,
      priority,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      dueDate: dueDate || null,
    });
    onClose();
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!window.confirm(`¿Eliminar la nota "${note.title}"? Esta acción no se puede deshacer.`)) return;
    onDelete();
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-96 space-y-3 rounded-lg bg-white p-5 shadow-xl"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border px-2 py-1.5 font-medium text-gray-900"
          placeholder="Título"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
          rows={3}
          placeholder="Descripción / observaciones"
        />

        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Color</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Color personalizado"
              className="h-6 w-7 cursor-pointer rounded border border-gray-300 p-0"
            />
          </div>
        </div>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
        >
          <option value="low">Prioridad baja</option>
          <option value="medium">Prioridad media</option>
          <option value="high">Prioridad alta</option>
        </select>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
          placeholder="Tags separados por coma"
        />

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
        />

        <div className="flex items-center justify-between pt-2">
          {onDelete ? (
            <button onClick={handleDelete} className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
              Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded px-3 py-1.5 text-sm text-gray-600">
              Cancelar
            </button>
            <button onClick={handleSave} className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white">
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
