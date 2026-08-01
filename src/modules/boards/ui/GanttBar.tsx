// src/modules/boards/ui/GanttBar.tsx
'use client';

import { useRef } from 'react';
import type { Note } from '../domain/types';
import { shiftDate, pxPerDayForZoom, type GanttZoom } from '../domain/gantt';

const BAR_HEIGHT = 20;
const ROW_HEIGHT = 36;

export function GanttBar({
  note,
  left,
  width,
  conflict,
  canEdit,
  zoom,
  isConnectTarget,
  isConnectTargetInvalid,
  onCommitDates,
  onStartConnect,
  onOpen,
}: {
  note: Note;
  left: number;
  width: number;
  conflict: boolean;
  canEdit: boolean;
  zoom: GanttZoom;
  isConnectTarget?: boolean;
  isConnectTargetInvalid?: boolean;
  onCommitDates: (noteId: string, startDate: string, endDate: string) => void;
  onStartConnect: (noteId: string) => void;
  onOpen: (note: Note) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    mode: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originWidth: number;
  } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, mode: 'move' | 'resize-start' | 'resize-end') {
    if (!canEdit) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { mode, startX: e.clientX, originWidth: width };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    const el = barRef.current;
    if (!state || !el) return;
    const dx = e.clientX - state.startX;
    if (state.mode === 'move') {
      el.style.transform = `translateX(${dx}px)`;
    } else if (state.mode === 'resize-end') {
      el.style.width = `${Math.max(state.originWidth + dx, 12)}px`;
    } else {
      el.style.transform = `translateX(${dx}px)`;
      el.style.width = `${Math.max(state.originWidth - dx, 12)}px`;
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    dragState.current = null;
    const el = barRef.current;
    if (!state || !el || !note.startDate) return;

    const dx = e.clientX - state.startX;
    const pxPerDay = pxPerDayForZoom(zoom);
    const dayDelta = Math.round(dx / pxPerDay);
    el.style.transform = '';
    el.style.width = `${width}px`;

    if (dayDelta === 0) return;

    const currentEnd = note.endDate ?? note.startDate;
    if (state.mode === 'move') {
      onCommitDates(note.id, shiftDate(note.startDate, dayDelta), shiftDate(currentEnd, dayDelta));
    } else if (state.mode === 'resize-end') {
      const newEnd = shiftDate(currentEnd, dayDelta);
      if (newEnd < note.startDate) return;
      onCommitDates(note.id, note.startDate, newEnd);
    } else {
      const newStart = shiftDate(note.startDate, dayDelta);
      if (newStart > currentEnd) return;
      onCommitDates(note.id, newStart, currentEnd);
    }
  }

  return (
    <div
      ref={barRef}
      data-note-id={note.id}
      onDoubleClick={() => onOpen(note)}
      style={{
        position: 'absolute',
        left,
        width,
        top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
        height: BAR_HEIGHT,
        backgroundColor: note.color,
      }}
      className={`group rounded-[5px] shadow-elevation-sm transition-shadow duration-100 ${
        conflict ? 'border-2 border-danger' : ''
      } ${
        isConnectTarget
          ? isConnectTargetInvalid
            ? 'ring-2 ring-danger ring-offset-1'
            : 'ring-2 ring-accent-500 ring-offset-1'
          : ''
      }`}
      title={note.title}
    >
      {canEdit && (
        <>
          <div
            onPointerDown={(e) => handlePointerDown(e, 'move')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
          />
          <div
            onPointerDown={(e) => handlePointerDown(e, 'resize-start')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(e) => handlePointerDown(e, 'resize-end')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize"
          />
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(note.id);
            }}
            className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-white bg-accent-500 opacity-0 shadow-elevation-sm group-hover:opacity-100"
            title="Arrastrar hasta otra nota para crear una dependencia"
          />
        </>
      )}
    </div>
  );
}
