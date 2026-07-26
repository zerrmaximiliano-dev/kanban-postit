'use client';

import { useState } from 'react';
import type { ChecklistItem, Note, Priority } from '../domain/types';

const COLORS = ['#FDE8C8', '#FBD4D4', '#D6ECD2', '#CFE3F5', '#E6D9F2', '#FCF4CB'];

export function NoteEditor({
  note,
  onClose,
  onSave,
  onDelete,
  onAddChecklistItem,
  onToggleChecklistItem,
  onEditChecklistItemText,
  onDeleteChecklistItem,
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
  onAddChecklistItem?: (text: string) => Promise<ChecklistItem>;
  onToggleChecklistItem?: (item: ChecklistItem, done: boolean) => void;
  onEditChecklistItemText?: (item: ChecklistItem, text: string) => void;
  onDeleteChecklistItem?: (item: ChecklistItem) => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description);
  const [color, setColor] = useState(note.color);
  const [priority, setPriority] = useState<Priority>(note.priority);
  const [tagsInput, setTagsInput] = useState(note.tags.join(', '));
  const [dueDate, setDueDate] = useState(note.dueDate ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist);
  const [newItemText, setNewItemText] = useState('');

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

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    const text = newItemText.trim();
    if (!text || !onAddChecklistItem) return;
    setNewItemText('');
    const item = await onAddChecklistItem(text);
    setChecklist((prev) => [...prev, item]);
  }

  function handleToggleItem(item: ChecklistItem) {
    const done = !item.done;
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, done } : i)));
    onToggleChecklistItem?.(item, done);
  }

  function handleEditItemText(item: ChecklistItem, text: string) {
    setChecklist((prev) => prev.map((i) => (i.id === item.id ? { ...i, text } : i)));
  }

  function commitItemText(item: ChecklistItem) {
    const current = checklist.find((i) => i.id === item.id);
    if (current) onEditChecklistItemText?.(item, current.text);
  }

  function handleDeleteItem(item: ChecklistItem) {
    setChecklist((prev) => prev.filter((i) => i.id !== item.id));
    onDeleteChecklistItem?.(item);
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: `radial-gradient(ellipse at center, #ffffff 55%, ${color}55 100%)` }}
        className="max-h-[85vh] w-96 space-y-3 overflow-y-auto rounded-lg p-5 shadow-xl"
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

        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Lista de tareas</p>
          <div className="space-y-1">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleToggleItem(item)}
                  className="h-4 w-4 shrink-0"
                />
                <input
                  value={item.text}
                  onChange={(e) => handleEditItemText(item, e.target.value)}
                  onBlur={() => commitItemText(item)}
                  className={`w-full rounded border-none bg-transparent px-1 py-0.5 text-sm text-gray-900 focus:bg-white focus:ring-1 focus:ring-gray-300 ${
                    item.done ? 'text-gray-400 line-through' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item)}
                  className="shrink-0 text-gray-400 hover:text-red-600"
                  aria-label="Eliminar tarea"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddItem} className="mt-1.5 flex gap-1.5">
            <input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="+ Agregar tarea"
              className="w-full rounded border px-2 py-1 text-sm text-gray-900"
            />
            <button type="submit" className="shrink-0 rounded bg-gray-200 px-2 py-1 text-sm text-gray-700">
              Agregar
            </button>
          </form>
        </div>

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
