// src/modules/boards/domain/types.ts
export type Priority = 'low' | 'medium' | 'high';

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  orgId: string | null;
}

export interface Column {
  id: string;
  boardId: string;
  name: string;
  order: number;
}

export interface ChecklistItem {
  id: string;
  noteId: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Note {
  id: string;
  columnId: string;
  title: string;
  description: string;
  color: string;
  priority: Priority;
  tags: string[];
  startDate: string | null; // 'YYYY-MM-DD' or null
  endDate: string | null; // 'YYYY-MM-DD' or null; null means same day as startDate
  order: number;
  checklist: ChecklistItem[];
}
