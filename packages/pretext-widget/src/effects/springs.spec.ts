import { describe, expect, test } from 'vitest';
import { magnifyScale, restingSpring, stepSpring, type Spring } from './springs.js';
import { EffectsEngine } from './engine.js';

const home = { x: 100, y: 100 };
const run = (
  spring: Spring,
  frames: number,
  cursor: { x: number; y: number } | null,
  speed: number,
  mode: 'scatter' | 'magnify',
) => {
  let s = spring;
  for (let i = 0; i < frames; i++) s = stepSpring(s, home, cursor, speed, mode, () => 0.5);
  return s;
};
const dist = (s: Spring) => Math.hypot(s.dx, s.dy);

describe('cursor springs (learn-pretext scatter and magnify)', () => {
  test('words beyond the radius are not pushed', () => {
    const s = run(restingSpring(), 5, { x: 100 + 200, y: 100 }, 30, 'scatter');
    expect(dist(s)).toBe(0);
  });

  test('scatter pushes words away from the cursor, harder when it moves fast', () => {
    const slow = run(restingSpring(), 3, { x: 80, y: 100 }, 0, 'scatter');
    const fast = run(restingSpring(), 3, { x: 80, y: 100 }, 40, 'scatter');
    expect(dist(fast)).toBeGreaterThan(dist(slow));
    expect(fast.dx).toBeGreaterThan(0); // the cursor is to the left, so the word moves right
  });

  test('words spring back home once the cursor leaves', () => {
    const pushed = run(restingSpring(), 5, { x: 80, y: 100 }, 40, 'scatter');
    expect(dist(pushed)).toBeGreaterThan(5);
    const settled = run(pushed, 120, null, 0, 'scatter');
    expect(dist(settled)).toBeLessThan(0.05);
  });

  test('magnify grows words gently near the cursor, up to 1.25x, with no edge', () => {
    expect(magnifyScale(0.001)).toBeCloseTo(1.25, 2);
    expect(magnifyScale(50)).toBeCloseTo(1.125, 2);
    expect(magnifyScale(120)).toBe(1);
    // Smooth falloff: almost no growth just inside the edge, so no visible jump.
    expect(magnifyScale(95) - 1).toBeLessThan(0.01);
  });
});

describe('effects engine', () => {
  test('is idle with no cursor, springs or bursts', () => {
    const engine = new EffectsEngine();
    engine.mode = 'scatter';
    expect(engine.isActive(0)).toBe(false);
    expect(engine.motion(0, 100, 100)).toBeNull();
  });

  test('moves words near the cursor and settles after the cursor leaves', () => {
    const engine = new EffectsEngine();
    engine.mode = 'scatter';
    engine.pointer(80, 100);
    engine.pointer(90, 100);
    let moved = null;
    for (let frame = 1; frame <= 3; frame++) {
      engine.beginFrame(frame * 16);
      moved = engine.motion(3, 100, 100);
    }
    expect(moved).not.toBeNull();
    engine.pointerLeave();
    for (let frame = 4; frame < 200; frame++) {
      engine.beginFrame(frame * 16);
      engine.motion(3, 100, 100);
    }
    expect(engine.motion(3, 100, 100)).toBeNull();
    expect(engine.isActive(200 * 16)).toBe(false);
  });

  test('magnify reports a scale for words near the cursor', () => {
    const engine = new EffectsEngine();
    engine.mode = 'magnify';
    engine.pointer(100, 100);
    // The lens eases in over a few frames.
    for (let frame = 1; frame <= 30; frame++) engine.beginFrame(frame * 16);
    expect(engine.motion(1, 110, 100)!.scale).toBeGreaterThan(1.15);
  });

  test('a word is stepped once per frame even if it is asked twice', () => {
    const engine = new EffectsEngine();
    engine.mode = 'scatter';
    engine.pointer(60, 100);
    engine.pointer(80, 100);
    engine.beginFrame(16);
    const first = engine.motion(2, 100, 100);
    const again = engine.motion(2, 100, 100);
    expect(again).toEqual(first);
  });
});

describe('magnify as a lens', () => {
  const engineAt = () => {
    const engine = new EffectsEngine();
    engine.mode = 'magnify';
    engine.pointer(100, 100);
    for (let frame = 1; frame <= 30; frame++) engine.beginFrame(frame * 16);
    return engine;
  };

  test('grown words never overlap their neighbours, and nothing is moved', () => {
    const engine = engineAt();
    // A line of words of different widths with 6px gaps, centred on the cursor.
    const widths = [30, 150, 60, 90, 40, 120];
    let x = 100 - 200;
    const words = widths.map((w, i) => {
      const word = { text: `w${i}`, x, y: 90 };
      x += w + 6;
      return { word, w };
    });
    const extents = words.map(({ word, w }, i) => {
      const m = engine.motion(i, word.x + w / 2, 100, word);
      expect(m?.dx ?? 0).toBe(0);
      const scale = m?.scale ?? 1;
      return [word.x + w / 2 - (w * scale) / 2, word.x + w / 2 + (w * scale) / 2];
    });
    for (let i = 1; i < extents.length; i++) {
      expect(extents[i][0]).toBeGreaterThanOrEqual(extents[i - 1][1] - 1e-9);
    }
    expect(
      Math.max(
        ...words.map(({ word, w }, i) => engine.motion(i, word.x + w / 2, 100, word)?.scale ?? 1),
      ),
    ).toBeGreaterThan(1.05);
  });

  test('the lens fades out over several frames when the cursor leaves', () => {
    const engine = engineAt();
    const near = () => engine.motion(1, 110, 100)?.scale ?? 1;
    const before = near();
    engine.pointerLeave();
    engine.beginFrame(31 * 16);
    const after1 = near();
    expect(after1).toBeLessThan(before);
    expect(after1).toBeGreaterThan(1);
    for (let frame = 32; frame < 80; frame++) engine.beginFrame(frame * 16);
    expect(near()).toBe(1);
    expect(engine.isActive(80 * 16)).toBe(false);
  });
});
