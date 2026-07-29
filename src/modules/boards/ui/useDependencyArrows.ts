// src/modules/boards/ui/useDependencyArrows.ts
'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { NoteDependency } from '../domain/types';

export interface DependencyArrow {
  id: string;
  d: string;
  midX: number;
  midY: number;
}

// Row positions depend on rendered DOM layout (group headers, row height,
// scroll position) rather than something computable in pure domain logic,
// so arrows are measured directly off the bar elements via
// getBoundingClientRect, the same way real Gantt/diagram libraries do this.
// Recomputing on every render (no dependency array on the effect below) is
// an accepted simplification for the expected board sizes — revisit only if
// it proves to be a real perf problem in practice.
export function useDependencyArrows(
  containerRef: RefObject<HTMLDivElement | null>,
  dependencies: NoteDependency[]
): DependencyArrow[] {
  const [arrows, setArrows] = useState<DependencyArrow[]>([]);

  useLayoutEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const next: DependencyArrow[] = [];
      for (const dep of dependencies) {
        const fromEl = container.querySelector<HTMLElement>(`[data-note-id="${dep.predecessorNoteId}"]`);
        const toEl = container.querySelector<HTMLElement>(`[data-note-id="${dep.successorNoteId}"]`);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        const x1 = fromRect.right - containerRect.left + container.scrollLeft;
        const y1 = fromRect.top + fromRect.height / 2 - containerRect.top + container.scrollTop;
        const x2 = toRect.left - containerRect.left + container.scrollLeft;
        const y2 = toRect.top + toRect.height / 2 - containerRect.top + container.scrollTop;
        const midX = (x1 + x2) / 2;

        next.push({
          id: dep.id,
          d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
          midX,
          midY: (y1 + y2) / 2,
        });
      }
      setArrows(next);
    }

    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  });

  return arrows;
}
