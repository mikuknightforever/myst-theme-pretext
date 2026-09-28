/** Cursor effects from learn-pretext.com: every word is a damped spring pulled
 * back to its laid-out position, and the cursor adds a force depending on mode.
 * Offsets are purely visual; the layout never changes. */

export type HoverMode = 'scatter' | 'magnify';

export interface Spring {
  dx: number;
  dy: number;
  vx: number;
  vy: number;
}

const HOME_PULL = 0.07; // share of the distance home added to velocity per frame
const DAMPING = 0.78;
const SCATTER_RADIUS = 150;
const MAGNIFY_RADIUS = 100;
const MAGNIFY_MAX_GROWTH = 0.25;

/** 1 at the cursor, easing to 0 at `radius` with no visible edge. */
function magnifyFalloff(distance: number, radius = MAGNIFY_RADIUS): number {
  if (distance >= radius) return 0;
  const t = 1 - distance / radius;
  return t * t * (3 - 2 * t);
}

/** Word gap the lens may use: each word grows by at most half of it per side,
 * so neighbours never overlap, without moving any word. */
const MAGNIFY_GAP = 6;

/** Growth of a word of `width` px at `distance` from the cursor. Short words may
 * grow up to the maximum; long words only as far as the gaps around them allow. */
export function magnifyGrowth(distance: number, width?: number): number {
  const growth = magnifyFalloff(distance) * MAGNIFY_MAX_GROWTH;
  return width && width > 0 ? Math.min(growth, MAGNIFY_GAP / width) : growth;
}

export function restingSpring(): Spring {
  return { dx: 0, dy: 0, vx: 0, vy: 0 };
}

export function isAtRest(spring: Spring): boolean {
  return (
    Math.abs(spring.dx) < 0.05 &&
    Math.abs(spring.dy) < 0.05 &&
    Math.abs(spring.vx) < 0.05 &&
    Math.abs(spring.vy) < 0.05
  );
}

export function magnifyScale(distance: number): number {
  return 1 + magnifyFalloff(distance) * MAGNIFY_MAX_GROWTH;
}

/** Advance one word by one frame. `home` is its laid-out centre, `speed` the
 * smoothed cursor speed in px per frame. */
export function stepSpring(
  spring: Spring,
  home: { x: number; y: number },
  cursor: { x: number; y: number } | null,
  speed: number,
  mode: HoverMode,
  random: () => number = Math.random,
): Spring {
  const { dx, dy } = spring;
  let { vx, vy } = spring;
  if (cursor) {
    const ex = home.x + dx - cursor.x;
    const ey = home.y + dy - cursor.y;
    const r = Math.hypot(ex, ey);
    if (mode === 'scatter' && r > 0 && r < SCATTER_RADIUS) {
      const closeness = 1 - r / SCATTER_RADIUS;
      const energy = Math.min(speed / 12, 1);
      if (energy > 0.2) {
        const push = closeness * (3 + energy * 20) * 0.5;
        vx += (ex / r) * push;
        vy += (ey / r) * push;
      } else {
        vx += (random() - 0.5) * closeness * 1.2;
        vy += (random() - 0.5) * closeness * 1.2;
      }
    } else if (mode === 'magnify' && r > 0 && r < MAGNIFY_RADIUS) {
      // Just enough spread that grown words do not overlap their neighbours.
      const push = magnifyFalloff(r) * 0.2;
      vx += (ex / r) * push;
      vy += (ey / r) * push;
    }
  }
  vx = (vx - dx * HOME_PULL) * DAMPING;
  vy = (vy - dy * HOME_PULL) * DAMPING;
  return { dx: dx + vx, dy: dy + vy, vx, vy };
}

export const SPRING_REACH = SCATTER_RADIUS;
