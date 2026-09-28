import { describe, expect, test } from 'vitest';
import { LeafField, MAX_LEAVES, leafParting, type Leaf } from './leaves.js';
import { EffectsEngine } from './engine.js';

const leaf = (x: number, y: number, size = 50): Leaf => ({
  shape: 0,
  size,
  x,
  y,
  vx: 0,
  vy: 80,
  rotation: 0,
  spin: 0,
  sway: 0,
  swayPhase: 0,
});

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
});

describe('falling leaves', () => {
  test('leaves fall, cycle through the logo leaves and sizes, and leave the view', () => {
    const field = new LeafField(() => 0.5);
    field.setView(0, 800, 1000);
    for (let t = 0; t <= 20000; t += 16) field.step(t);
    const spawned = field.spawnedShapes;
    expect(new Set(spawned.slice(0, 3)).size).toBe(3);
    expect(new Set(field.spawnedSizes.slice(0, 4)).size).toBe(4);
    expect(field.leaves.length).toBeLessThanOrEqual(MAX_LEAVES);
    const before = field.leaves.map((l) => l.y);
    field.step(20016);
    for (let i = 0; i < field.leaves.length; i++) {
      if (before[i] !== undefined) expect(field.leaves[i].y).toBeGreaterThan(before[i] - 1);
    }
    // Leaves below the view are gone.
    expect(field.leaves.every((l) => l.y < 800 + 2 * l.size)).toBe(true);
  });

  test('leaves stay away from the edges of the text', () => {
    let r = 0;
    const field = new LeafField(() => (r = (r + 0.37) % 1));
    field.setView(0, 4000, 1000);
    const drifting = { ...leaf(160, 100), vx: -200 };
    field.leaves.push(drifting);
    for (let t = 0; t <= 5000; t += 16) {
      field.step(t, false);
      expect(drifting.x).toBeGreaterThanOrEqual(150);
      expect(drifting.x).toBeLessThanOrEqual(850);
    }
  });

  test('the engine parts words near a leaf in leaves mode', () => {
    const engine = new EffectsEngine();
    engine.mode = 'leaves';
    engine.setView(0, 800, 1000);
    engine.leafField.leaves.push(leaf(300, 100));
    engine.beginFrame(16);
    expect(engine.isActive(16)).toBe(true);
    const near = engine.motion(1, 330, 100, { text: 'w', x: 320, y: 90 });
    expect(near?.dx ?? 0).toBeGreaterThan(5);
    expect(engine.motion(2, 330, 700, { text: 'w', x: 320, y: 690 })).toBeNull();
  });
});
