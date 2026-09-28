/** One place to ask where a word is drawn right now, combining every effect. */
import { combinedOffset, isBurstActive, type Burst } from './explode.js';
import { introMotion, isIntroActive, type WordMotion } from './intro.js';

export type { WordMotion } from './intro.js';

export function isMotionActive(
  bursts: Burst[],
  introElapsed: number | null | undefined,
  now: number,
): boolean {
  return isIntroActive(introElapsed) || bursts.some((burst) => isBurstActive(burst, now));
}

/** Motion of the word centred at (cx, cy), or null when it sits in its place. */
export function wordMotion(
  cx: number,
  cy: number,
  index: number,
  bursts: Burst[],
  /** Milliseconds into the opening animation, or null when it is not running. */
  introElapsed: number | null | undefined,
  now: number,
): WordMotion | null {
  const burst = bursts.length ? combinedOffset(cx, cy, index, bursts, now) : null;
  const intro = introMotion(index, introElapsed);
  if (!burst && !intro) return null;
  return {
    dx: (burst?.dx ?? 0) + (intro?.dx ?? 0),
    dy: (burst?.dy ?? 0) + (intro?.dy ?? 0),
    rotation: burst?.rotation ?? 0,
    alpha: intro?.alpha ?? 1,
  };
}
