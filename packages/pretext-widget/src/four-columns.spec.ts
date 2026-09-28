import { describe, expect, test } from 'vitest';
import { getColumnFrames } from './column-layout.js';

describe('four columns', () => {
  test('splits the width into four equal frames with gaps', () => {
    const frames = getColumnFrames(1400, { count: 4, gap: 32, columnHeight: 980, bandGap: 24 });
    expect(frames).toHaveLength(4);
    expect(frames[0].width).toBeCloseTo((1400 - 3 * 32) / 4, 5);
    expect(frames[3].right).toBeCloseTo(1400, 5);
  });
});
