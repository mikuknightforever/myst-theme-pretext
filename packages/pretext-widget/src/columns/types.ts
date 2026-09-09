import type { ContentBlock } from '../layout/types.js';

export type ColumnCount = 1 | 2 | 3;

export interface ColumnLayoutOptions {
  count: ColumnCount;
  gap: number;
  /** Height of one newspaper-like column band before content moves right. */
  columnHeight?: number;
  /** Vertical breathing room between successive column bands. */
  bandGap?: number;
}

export interface ColumnFrame {
  left: number;
  right: number;
  width: number;
}

export type ColumnTextBlock = Extract<ContentBlock, { type: 'paragraph' | 'listItem' }>;

export const DEFAULT_COLUMN_HEIGHT = 980;
export const DEFAULT_BAND_GAP = 24;
