'use client';

import { useState } from 'react';
import type { ChecklistItem, Note, Priority } from '../domain/types';
import { Button } from '@/src/modules/ui/Button';
import { Input } from '@/src/modules/ui/Input';
import { TrashIcon } from '@/src/modules/ui/icons';

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
    startDate: string | null;
    endDate: string | null;
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
  const [startDate, setStartDate] = useState(note.startDate ?? '');
  const [endDate, setEndDate] = useState(note.endDate ?? '');
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
      startDate: startDate || null,
      endDate: endDate || null,
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: `radial-gradient(ellipse at top right, ${color}33 0%, var(--color-surface) 55%)` }}
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto p-6 shadow-elevation-md animate-[drawer-in_250ms_ease-standard]"
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} label="Título" placeholder="Título de la nota" />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink transition-[border-color,box-shadow] duration-150 ease-standard focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            rows={3}
            placeholder="Descripción / observaciones"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Color</p>
          <div className="flex flex-wrap items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
                className={`h-7 w-7 rounded-full transition-transform duration-150 ease-standard hover:scale-110 ${
                  color === c ? 'ring-2 ring-accent-500 ring-offset-2' : 'ring-1 ring-black/10'
                }`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Color personalizado"
              className="h-7 w-9 cursor-pointer rounded-control border border-border p-0"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Prioridad</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
          >
            <option value="low">Prioridad baja</option>
            <option value="medium">Prioridad media</option>
            <option value="high">Prioridad alta</option>
          </select>
        </div>

        <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} label="Tags" placeholder="Separados por coma" />

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Fechas (para el calendario)</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
              aria-label="Fecha de inicio"
            />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
              aria-label="Fecha de fin"
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-muted">Lista de tareas</p>
          <div className="space-y-1">
            {checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-control px-1 py-0.5 hover:bg-page">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => handleToggleItem(item)}
                  className="h-4 w-4 shrink-0 accent-accent-500"
                />
                <input
                  value={item.text}
                  onChange={(e) => handleEditItemText(item, e.target.value)}
                  onBlur={() => commitItemText(item)}
                  className={`w-full rounded-control border-none bg-transparent px-1 py-0.5 text-sm text-ink focus:bg-surface focus:ring-1 focus:ring-border-strong ${
                    item.done ? 'text-ink-faint line-through' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item)}
                  className="shrink-0 text-ink-faint opacity-0 transition-opacity duration-150 ease-standard hover:text-danger group-hover:opacity-100"
                  aria-label="Eliminar tarea"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddItem} className="mt-2 flex gap-2">
            <input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Agregar tarea"
              className="w-full rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
            <Button type="submit" variant="secondary" className="shrink-0">
              Agregar
            </Button>
          </form>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
          {onDelete ? (
            <Button variant="danger" onClick={handleDelete}>
              <TrashIcon className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
