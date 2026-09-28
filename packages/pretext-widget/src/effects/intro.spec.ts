import { describe, expect, test } from 'vitest';
import { INTRO_MAX_STEP_MS, INTRO_MS, advanceIntro, introMotion } from './intro.js';
import { wordMotion } from './motion.js';
import type { Burst } from './explode.js';

describe('grid-snap opening animation', () => {
  test('words start scattered and invisible', () => {
    const offsets = Array.from({ length: 40 }, (_, i) => introMotion(i, 0)!);
    expect(offsets.every((o) => o.alpha === 0)).toBe(true);
    const spread = offsets.map((o) => Math.hypot(o.dx, o.dy));
    expect(Math.max(...spread)).toBeGreaterThan(200);
    // Scattered in different directions, not all shifted the same way.
    expect(new Set(offsets.map((o) => Math.sign(o.dx))).size).toBe(2);
  });

  test('each word travels in a straight line, without rotating', () => {
    const first = introMotion(3, 0)!;
    for (const t of [200, 500, 800]) {
      const later = introMotion(3, t)!;
      expect(later.rotation).toBe(0);
      // Same direction as the starting offset, only shorter.
      expect(later.dx * first.dy - later.dy * first.dx).toBeCloseTo(0, 6);
      expect(Math.hypot(later.dx, later.dy)).toBeLessThanOrEqual(Math.hypot(first.dx, first.dy));
    }
  });

  test('every word has snapped into place when the intro ends', () => {
    for (let i = 0; i < 30; i++) expect(introMotion(i, INTRO_MS)).toBeNull();
    expect(introMotion(0, null)).toBeNull();
  });

  test('a stalled frame advances the intro by one step, so it is not skipped', () => {
    expect(advanceIntro(0, 1500)).toBe(INTRO_MAX_STEP_MS);
    expect(advanceIntro(100, 16)).toBe(116);
    expect(advanceIntro(INTRO_MS - 5, 16)).toBeNull();
    expect(advanceIntro(null, 16)).toBeNull();
  });

  test('explosions and the intro combine into one motion', () => {
    const burst: Burst = { x: 0, y: 0, start: 5000, seed: 2 };
    const intro = introMotion(1, 300)!;
    const both = wordMotion(10, 0, 1, [burst], 300, 5300)!;
    expect(both.alpha).toBe(intro.alpha);
    expect(both.dx).not.toBeCloseTo(intro.dx, 3);
    expect(wordMotion(10, 0, 1, [], null, 5300)).toBeNull();
  });
});
