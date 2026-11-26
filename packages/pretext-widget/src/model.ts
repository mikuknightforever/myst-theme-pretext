import type { ColumnCount } from './column-layout.js';
import type { FigureRegion } from './figure-regions.js';

export interface FigureInfo {
  mdastNode: any;
  label: string;
  imageUrl: string | null;
  /** A single notebook output: dragged by its header and scaled to fit. */
  interactive?: boolean;
  /** Parts of the figure linked to the sections that describe them. */
  regions?: FigureRegion[];
}

export interface FigurePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  inline: boolean;
  /** Pinned beside the text: out of the flow, in its own lane. */
  pinned?: boolean;
}

export interface FigureLayoutState {
  width: number;
  columns: ColumnCount;
  readingKey: string;
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
