import type { ColumnCount } from './column-layout.js';

export interface FigureInfo {
  mdastNode: any;
  label: string;
  imageUrl: string | null;
}

export interface FigurePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  inline: boolean;
}

export interface FigureLayoutState {
  width: number;
  columns: ColumnCount;
  positions: FigurePosition[];
}

export interface DragState {
  figIndex: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  mode: 'move' | 'resize';
}
