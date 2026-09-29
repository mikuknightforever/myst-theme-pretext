import { describe, expect, test } from 'vitest';
import {
  LeafField,
  MAX_LEAVES,
  REGROW_MS,
  SHIP_SIZE,
  leafParting,
  partRow,
  type Leaf,
} from './leaves.js';
import { EffectsEngine } from './engine.js';

const leaf = (x: number, y: number, size = 50): Leaf => ({
  shape: 0,
  size,
  targetSize: size,
  x,
  y,
  vx: 0,
  vy: 80,
  fall: 80,
  rotation: 0,
  spin: 0,
  restSpin: 0,
  sway: 0,
  swayPhase: 0,
});

/** A repeatable stand-in for Math.random. */
const seeded = () => {
  let r = 0.1;
  return () => (r = (r * 9301 + 0.49297) % 1);
};

/** Step a field at 60 frames per second from `from` to `to` (ms). */
const run = (field: LeafField, from: number, to: number, active = true) => {
  for (let t = from; t <= to; t += 16) field.step(t, active);
};

describe('text parting around a falling leaf', () => {
  test('words on the leaf rows part to both sides, far words stay', () => {
    const l = leaf(300, 100);
    expect(leafParting(260, 100, [l])).toBeLessThan(-5);
    expect(leafParting(340, 100, [l])).toBeGreaterThan(5);
    expect(Math.abs(leafParting(340, 400, [l]))).toBeLessThan(0.5); // rows far below
    expect(Math.abs(leafParting(900, 100, [l]))).toBeLessThan(0.5); // far along the row
  });

  test('words on a row keep their order', () => {
    const l = leaf(300, 100);
    let previous = -Infinity;
    for (let x = 0; x <= 600; x += 10) {
      const drawn = x + leafParting(x, 100, [l]);
      expect(drawn).toBeGreaterThan(previous);
      previous = drawn;
    }
  });

  test('as a leaf falls past a word, the word moves smoothly and closes back behind it', () => {
    let last = 0;
    let largest = 0;
    for (let y = -200; y <= 400; y += 80 / 60) {
      const offset = leafParting(320, 100, [leaf(300, y)]);
      expect(Math.abs(offset - last)).toBeLessThan(2);
      largest = Math.max(largest, Math.abs(offset));
      last = offset;
    }
    expect(largest).toBeGreaterThan(8);
    expect(Math.abs(last)).toBeLessThan(0.5);
  });

  test('a parted row never overlaps, never leaves the row, and keeps every space readable', () => {
    // 20 words of 50 px with 6 px spaces: 1114 px long.
    const lefts = Array.from({ length: 20 }, (_, i) => i * 56);
    const widths = lefts.map(() => 50);
    for (const size of [30, 58, SHIP_SIZE]) {
      for (const at of [0, 200, 555, 1100]) {
        const obstacle = leaf(at, 100, size);
        const desired = lefts.map((x, i) => leafParting(x + widths[i] / 2, 100, [obstacle]));
        const parted = partRow(lefts, widths, desired);
        expect(lefts[0] + parted[0]).toBeGreaterThanOrEqual(-1e-9);
        expect(lefts[19] + widths[19] + parted[19]).toBeLessThanOrEqual(1114 + 1e-9);
        for (let i = 0; i < 19; i++) {
          const space = lefts[i + 1] + parted[i + 1] - (lefts[i] + widths[i] + parted[i]);
          expect(space).toBeGreaterThanOrEqual(6 * 0.3 - 1e-9);
        }
      }
    }
  });

  test('a parted row opens a gap where the obstacle is', () => {
    const lefts = Array.from({ length: 20 }, (_, i) => i * 56);
    const widths = lefts.map(() => 50);
    const obstacle = leaf(555, 100, 58);
    const desired = lefts.map((x, i) => leafParting(x + widths[i] / 2, 100, [obstacle]));
    const parted = partRow(lefts, widths, desired);
    // Words 9 and 10 sit either side of x = 555; the space between them grows.
    const space = lefts[10] + parted[10] - (lefts[9] + widths[9] + parted[9]);
    expect(space).toBeGreaterThan(30);
  });

  test('with plenty of room a row parts exactly as asked', () => {
    const lefts = [0, 100, 200, 300];
    const widths = [20, 20, 20, 20];
    const desired = [0, -3, 3, 0];
    expect(partRow(lefts, widths, desired)).toEqual(desired);
  });
});

describe('the floating logo', () => {
  test('flies in and stays in the middle of the view', () => {
    const field = new LeafField(seeded());
    field.setView(0, 1000, 1200);
    run(field, 0, 20000);
    const ship = field.ship!;
    expect(ship).not.toBeNull();
    // It aims for the middle half of the view; overshoot stays small.
    expect(ship.x).toBeGreaterThan(1200 * 0.15);
    expect(ship.x).toBeLessThan(1200 * 0.85);
    expect(ship.y).toBeGreaterThan(1000 * 0.1);
    expect(ship.y).toBeLessThan(1000 * 0.9);
  });

  test('fires its three leaves outward plus smaller ones, then grows them back', () => {
    const field = new LeafField(seeded());
    field.setView(0, 1000, 1200);
    run(field, 0, 2000);
    expect(field.volleys).toBe(0);
    const centre = field.shipCentre(2000)!;
    expect(field.fire(2000)).toBe(true);
    expect(field.leaves.map((l) => l.shape).slice(0, 3)).toEqual([0, 1, 2]);
    expect(field.leaves.length).toBe(5);
    // Each logo leaf flies away from the logo's centre.
    for (const l of field.leaves.slice(0, 3)) {
      const away = (l.x - centre.x) * l.vx + (l.y - centre.y) * l.vy;
      expect(away).toBeGreaterThan(0);
    }
    // No leaves left on the logo, so it cannot fire again straight away.
    expect(field.shipGrowth(2000)).toBe(0);
    expect(field.fire(2016)).toBe(false);
    expect(field.shipGrowth(2000 + 500 + REGROW_MS)).toBe(1);
  });

  test('launched leaves slow down, then fall', () => {
    const field = new LeafField(seeded());
    field.setView(0, 4000, 1200);
    run(field, 0, 2000);
    field.fire(2000);
    const start = field.leaves.map((l) => Math.hypot(l.vx, l.vy - l.fall));
    run(field, 2016, 3500);
    field.leaves.forEach((l, i) => {
      expect(Math.hypot(l.vx, l.vy - l.fall)).toBeLessThan(start[i] * 0.1);
      expect(l.vy).toBeGreaterThan(90);
      expect(l.size).toBeCloseTo(l.targetSize, 0);
    });
  });

  test('keeps firing on its own, never with more than the maximum leaves out', () => {
    const field = new LeafField(seeded());
    field.setView(0, 1000, 1200);
    for (let t = 0; t <= 40000; t += 16) {
      field.step(t);
      expect(field.leaves.length).toBeLessThanOrEqual(MAX_LEAVES);
    }
    expect(field.volleys).toBeGreaterThan(4);
  });

  test('clicks on the logo hit it, clicks elsewhere do not', () => {
    const field = new LeafField(seeded());
    field.setView(0, 1000, 1200);
    run(field, 0, 3000);
    const centre = field.shipCentre()!;
    expect(field.hitShip(centre.x + 10, centre.y - 10)).toBe(true);
    expect(field.hitShip(centre.x + SHIP_SIZE, centre.y)).toBe(false);
  });

  test('when turned off it flies away and the leaves out finish their fall', () => {
    const field = new LeafField(seeded());
    field.setView(0, 1000, 1200);
    run(field, 0, 2000);
    field.fire(2000);
    run(field, 2016, 4000, false);
    expect(field.volleys).toBe(1);
    run(field, 4016, 30000, false);
    expect(field.ship).toBeNull();
    expect(field.leaves).toEqual([]);
  });

  test('in the engine, words on a row never run into each other', () => {
    const engine = new EffectsEngine();
    engine.mode = 'leaves';
    engine.setView(0, 800, 1200);
    const words = Array.from({ length: 20 }, (_, i) => ({ text: 'w', x: i * 56, y: 390 }));
    engine.setWords(words);
    engine.leafField.leaves.push(leaf(300, 400, 58), leaf(700, 400, 58));
    // Two frames: the first learns each word's width.
    for (const now of [16, 32]) {
      engine.beginFrame(now);
      const drawn = words.map((w, i) => w.x + (engine.motion(i, w.x + 25, 400, w)?.dx ?? 0));
      if (now === 32) {
        for (let i = 0; i < 19; i++) expect(drawn[i + 1] - (drawn[i] + 50)).toBeGreaterThan(1.7);
        expect(drawn[0]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('the engine parts words around the logo and its leaves in leaves mode', () => {
    const engine = new EffectsEngine();
    engine.mode = 'leaves';
    engine.setView(0, 800, 1000);
    engine.leafField.leaves.push(leaf(300, 400));
    engine.beginFrame(16);
    expect(engine.isActive(16)).toBe(true);
    const near = engine.motion(1, 330, 400, { text: 'w', x: 320, y: 390 });
    expect(near?.dx ?? 0).toBeGreaterThan(5);
    // The logo starts above the view; words far below it are left alone.
    expect(engine.motion(2, 330, 5000, { text: 'w', x: 320, y: 4990 })).toBeNull();
  });
});
