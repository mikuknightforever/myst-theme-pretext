/** Click-to-explode: a purely visual offset for canvas-drawn words. The layout
 * is never changed; each word is drawn displaced from its laid-out position and
 * returns exactly to it when the burst ends. */

export interface Burst {
  /** Click position in content coordinates (the same space as word spans). */
  x: number;
  y: number;
  /** performance.now() timestamp of the click. */
  start: number;
  /** Varies the random motion between bursts. */
  seed: number;
}

export interface WordOffset {
  dx: number;
  dy: number;
  /** Radians. */
  rotation: number;
}

export const EXPLODE_RADIUS = 160;
export const EXPLODE_FLY_MS = 800;
export const EXPLODE_RETURN_MS = 600;
export const EXPLODE_TOTAL_MS = EXPLODE_FLY_MS + EXPLODE_RETURN_MS;

const GRAVITY = 1600; // px/s²
const MIN_SPEED = 350; // px/s at the edge of the radius
const EXTRA_SPEED = 650; // added at the click point
const UPWARD_KICK = 250; // px/s, scaled by closeness
const MAX_SPIN = 6 * Math.PI; // rad/s

/** Deterministic pseudo-random number in [0, 1) for one word of one burst. */
function random(seed: number, index: number, channel: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(index + 1, 0xc2b2ae35);
  h = Math.imul(h ^ (channel * 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
}

export function isBurstActive(burst: Burst, now: number): boolean {
  return now - burst.start < EXPLODE_TOTAL_MS;
}

/** Offset of the word centred at (cx, cy), or null when it is not displaced. */
export function explodeOffset(
  cx: number,
  cy: number,
  index: number,
  burst: Burst,
  now: number,
): WordOffset | null {
  const elapsed = now - burst.start;
  if (elapsed < 0 || elapsed >= EXPLODE_TOTAL_MS) return null;
  const distance = Math.hypot(cx - burst.x, cy - burst.y);
  if (distance > EXPLODE_RADIUS) return null;

  const closeness = 1 - distance / EXPLODE_RADIUS;
  const angle =
    distance < 1
      ? random(burst.seed, index, 0) * 2 * Math.PI
      : Math.atan2(cy - burst.y, cx - burst.x) + (random(burst.seed, index, 0) - 0.5) * 0.6;
  const speed = (MIN_SPEED + EXTRA_SPEED * closeness) * (0.75 + 0.5 * random(burst.seed, index, 1));
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed - UPWARD_KICK * closeness;
  const spin = (random(burst.seed, index, 2) - 0.5) * 2 * MAX_SPIN * closeness;

  const fly = (ms: number): WordOffset => {
    const t = ms / 1000;
    return { dx: vx * t, dy: vy * t + 0.5 * GRAVITY * t * t, rotation: spin * t };
  };
  if (elapsed <= EXPLODE_FLY_MS) return fly(elapsed);

  // Ease back from wherever the word landed to its laid-out position.
  const remaining = 1 - easeInOutCubic((elapsed - EXPLODE_FLY_MS) / EXPLODE_RETURN_MS);
  const landed = fly(EXPLODE_FLY_MS);
  return {
    dx: landed.dx * remaining,
    dy: landed.dy * remaining,
    rotation: landed.rotation * remaining,
  };
}

/** Combined offset of one word under every active burst. */
export function combinedOffset(
  cx: number,
  cy: number,
  index: number,
  bursts: Burst[],
  now: number,
): WordOffset | null {
  let result: WordOffset | null = null;
  for (const burst of bursts) {
    const offset = explodeOffset(cx, cy, index, burst, now);
    if (!offset) continue;
    result = result
      ? {
          dx: result.dx + offset.dx,
          dy: result.dy + offset.dy,
          rotation: result.rotation + offset.rotation,
        }
      : offset;
  }
  return result;
}
