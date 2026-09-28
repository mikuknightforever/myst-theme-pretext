import { DEFAULT_TEXT_STYLE } from './layout.js';

export const FIGURE_WIDTH_DEFAULT = 280;
export const FIGURE_HEIGHT_DEFAULT = 220;
export const FIGURE_MIN_W = 120;
export const FIGURE_MIN_H = 80;
export const FIGURE_INLINE_MAX_W = 820;
export const FIGURE_FALLBACK_ASPECT_RATIO = 1012 / 1800;
export const FIGURE_CAPTION_ESTIMATE_H = 62;
export const FIGURE_BLOCK_WIDTH_RATIO = 0.6;
export const COLUMN_GAP = 32;
export const COLUMN_MIN_WIDTH = 320;
export const COLUMN_PAGE_HEIGHT = 980;
export const COLUMN_PAGE_GAP = 24;
export const OVERLAY_PADDING = 40;

export const PRETEXT_TEXT_STYLE = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 16,
  lineHeight: 26,
  paragraphGap: 20,
};
