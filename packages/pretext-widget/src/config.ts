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
/** A pinned figure gets this share of the reading area, beside the text. */
export const PIN_WIDTH_RATIO = 0.42;
export const PIN_MIN_WIDTH = 240;
export const PIN_GAP = 32;
/** Distance between a pinned card and the top of the reading view; clears
 * the theme switch, which sits in the top-right corner. */
export const PIN_STICKY_TOP = 64;
/** Header strip of a pinned card: figure label, section being read, Unpin. */
export const PIN_HEADER_H = 30;

export const PRETEXT_TEXT_STYLE = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 16,
  lineHeight: 26,
  paragraphGap: 20,
};
