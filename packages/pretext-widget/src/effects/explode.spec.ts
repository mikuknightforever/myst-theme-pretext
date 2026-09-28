import { describe, expect, test } from 'vitest';
import {
  EXPLODE_RADIUS,
  EXPLODE_TOTAL_MS,
  explodeOffset,
  isBurstActive,
  type Burst,
} from './explode.js';

const burst: Burst = { x: 100, y: 100, start: 1000, seed: 7 };
const distance = (o: { dx: number; dy: number }) => Math.hypot(o.dx, o.dy);

describe('click-to-explode offsets', () => {
  test('words beyond the radius never move', () => {
    expect(explodeOffset(100 + EXPLODE_RADIUS + 1, 100, 0, burst, 1300)).toBeNull();
  });

  test('nothing has moved at the moment of the click', () => {
    const offset = explodeOffset(130, 100, 0, burst, burst.start);
    expect(offset).not.toBeNull();
    expect(distance(offset!)).toBeCloseTo(0, 5);
    expect(offset!.rotation).toBeCloseTo(0, 5);
  });

  test('closer words are thrown further, away from the click', () => {
    const near = explodeOffset(120, 100, 3, burst, burst.start + 200)!;
    const far = explodeOffset(100 + EXPLODE_RADIUS * 0.8, 100, 3, burst, burst.start + 200)!;
    expect(distance(near)).toBeGreaterThan(distance(far));
    // A word to the right of the click moves right.
    expect(near.dx).toBeGreaterThan(0);
  });

  test('every word is back in its exact place when the burst ends', () => {
    for (let index = 0; index < 20; index++) {
      const x = 100 + (index - 10) * 12;
      expect(explodeOffset(x, 110, index, burst, burst.start + EXPLODE_TOTAL_MS)).toBeNull();
    }
    expect(isBurstActive(burst, burst.start + EXPLODE_TOTAL_MS - 1)).toBe(true);
    expect(isBurstActive(burst, burst.start + EXPLODE_TOTAL_MS)).toBe(false);
  });

  test('the return eases smoothly to zero', () => {
    const late = explodeOffset(130, 100, 1, burst, burst.start + EXPLODE_TOTAL_MS - 16)!;
    expect(distance(late)).toBeLessThan(2);
  });

  test('the same word and burst always give the same motion', () => {
    expect(explodeOffset(140, 90, 5, burst, 1400)).toEqual(explodeOffset(140, 90, 5, burst, 1400));
  });
});
