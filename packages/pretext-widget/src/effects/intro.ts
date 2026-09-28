/** Grid snap: on opening, every word starts at a random spot and moves in a
 * straight line to its computed position, all at once, so the layout reads as
 * points being solved onto a grid. Purely visual, like the explode effect. */
import { random } from './explode.js';

export interface WordMotion {
  dx: number;
  dy: number;
  /** Radians. */
  rotation: number;
  /** 0 (invisible) to 1. */
  alpha: number;
}

export const INTRO_MS = 1100;
const MAX_DELAY_MS = 250;
const MOVE_MS = INTRO_MS - MAX_DELAY_MS;
const SPREAD_X = 600;
const SPREAD_Y = 400;
const INTRO_SEED = 0x51ab;

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

/** Longest step one frame may advance the intro. When the page stalls (charts
 * rendering, layout measuring), the animation slows down instead of being skipped. */
export const INTRO_MAX_STEP_MS = 34;

/** Intro time after one more frame, or null once it has finished. */
export function advanceIntro(elapsed: number | null, frameMs: number): number | null {
  if (elapsed == null) return null;
  const next = elapsed + Math.min(Math.max(0, frameMs), INTRO_MAX_STEP_MS);
  return next >= INTRO_MS ? null : next;
}

export function isIntroActive(elapsed: number | null | undefined): boolean {
  return elapsed != null && elapsed < INTRO_MS;
}

/** Where the word at `index` is drawn relative to its place, `elapsed` ms into
 * the intro, or null once it has settled. */
export function introMotion(index: number, elapsed: number | null | undefined): WordMotion | null {
  if (elapsed == null || !isIntroActive(elapsed)) return null;
  const delay = random(INTRO_SEED, index, 3) * MAX_DELAY_MS;
  const progress = Math.min(1, Math.max(0, (Math.max(0, elapsed) - delay) / MOVE_MS));
  const remaining = 1 - easeOutCubic(progress);
  return {
    dx: (random(INTRO_SEED, index, 4) * 2 - 1) * SPREAD_X * remaining,
    dy: (random(INTRO_SEED, index, 5) * 2 - 1) * SPREAD_Y * remaining,
    rotation: 0,
    alpha: Math.min(1, progress * 2),
  };
}
