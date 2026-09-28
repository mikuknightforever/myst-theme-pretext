import { describe, expect, test } from 'vitest';
import {
  INTRO_MAX_STEP_MS,
  INTRO_MS,
  SETTLE_MAX_WAIT_MS,
  advanceIntro,
  createSettleDetector,
  introMotion,
} from './intro.js';
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
    for (const t of [100, 300, 600]) {
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

describe('waiting for the page to settle before the intro', () => {
  test('starts after four quick frames in a row', () => {
    const detector = createSettleDetector();
    // The 200ms frame resets the count; the four frames after it settle.
    const frames = [900, 150, 20, 16, 200, 16, 17, 16, 16];
    const settled = frames.map((frameMs) => detector.frame(frameMs));
    expect(settled).toEqual([false, false, false, false, false, false, false, false, true]);
  });

  test('does not start while the layout is still changing', () => {
    const detector = createSettleDetector();
    // Quick frames, but the layout changed 100ms ago each time.
    for (let i = 0; i < 6; i++) expect(detector.frame(16, 100)).toBe(false);
    expect(detector.frame(16, 400)).toBe(true);
  });

  test('starts anyway once the maximum wait has passed', () => {
    const detector = createSettleDetector();
    let settled = false;
    for (let i = 0; i < 20 && !settled; i++) settled = detector.frame(250);
    expect(settled).toBe(true);
    expect(detector.waited).toBeGreaterThanOrEqual(SETTLE_MAX_WAIT_MS);
  });

  test('the intro is short and snappy', () => {
    expect(INTRO_MS).toBeLessThanOrEqual(800);
    // Most of the motion happens in the first third.
    const start = introMotion(7, 0)!;
    const early = introMotion(7, INTRO_MS / 3)!;
    expect(Math.hypot(early.dx, early.dy)).toBeLessThan(Math.hypot(start.dx, start.dy) * 0.3);
  });
});
