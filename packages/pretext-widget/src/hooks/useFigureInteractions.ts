import * as React from 'react';
import type { ColumnCount } from '../column-layout.js';
import { FIGURE_MIN_H, FIGURE_MIN_W } from '../config.js';
import type { DragState, FigureLayoutState, FigurePosition } from '../model.js';

/** Pointer interaction state; layout calculation stays in usePretextLayout. */
export function useFigureInteractions({
  figPositions,
  setFigureLayout,
  containerWidth,
  columnCount,
  readingKey,
}: {
  figPositions: FigurePosition[] | null;
  setFigureLayout: React.Dispatch<React.SetStateAction<FigureLayoutState | null>>;
  containerWidth: number;
  columnCount: ColumnCount;
  readingKey: string;
}) {
  const dragRef = React.useRef<DragState | null>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);
  const [resizingIdx, setResizingIdx] = React.useState<number | null>(null);
  function startDrag(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    if (!figPositions) return;
    setFigureLayout({
      width: containerWidth,
      columns: columnCount,
      readingKey,
      positions: figPositions,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = figPositions[idx];
    dragRef.current = {
      figIndex: idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: pos.width,
      origH: pos.height,
      mode: 'move',
    };
    setDraggingIdx(idx);
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    if (!figPositions) return;
    setFigureLayout({
      width: containerWidth,
      columns: columnCount,
      readingKey,
      positions: figPositions,
    });
    const pos = figPositions[idx];
    dragRef.current = {
      figIndex: idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: pos.width,
      origH: pos.height,
      mode: 'resize',
    };
    setResizingIdx(idx);
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const { figIndex, startX, startY, origX, origY, origW, origH, mode } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    setFigureLayout((prev) => {
      if (!prev || prev.width !== containerWidth) return prev;
      const next = [...prev.positions];
      const cur = prev.positions[figIndex];
      if (mode === 'move') {
        next[figIndex] = {
          ...cur,
          x: Math.max(0, Math.min(containerWidth - cur.width, origX + dx)),
          y: Math.max(0, origY + dy),
          inline: false,
        };
      } else {
        next[figIndex] = {
          ...cur,
          width: Math.min(containerWidth, Math.max(FIGURE_MIN_W, origW + dx)),
          height: Math.max(FIGURE_MIN_H, origH + dy),
          inline: false,
        };
      }
      return { ...prev, positions: next };
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDraggingIdx(null);
    setResizingIdx(null);
  }

  return { draggingIdx, resizingIdx, startDrag, startResize, moveDrag, endDrag };
}
