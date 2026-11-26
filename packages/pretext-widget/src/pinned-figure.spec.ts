import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { layoutWithFigures, pinnedLaneWidth, toObstacleRects } from './figure-layout.js';
import { DEFAULT_TEXT_STYLE, layoutBlocks, type ContentBlock, type StyledWord } from './layout.js';
import { COLUMN_MIN_WIDTH, PIN_GAP, PIN_MIN_WIDTH } from './config.js';
import type { FigurePosition } from './model.js';

const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 26, paragraphGap: 20 };
const words = (count: number): StyledWord[] =>
  Array.from({ length: count }, (_, i) => ({
    text: `word${i}`,
    bold: false,
    italic: false,
    code: false,
    spaceAfter: true,
  }));
beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({
        font: '',
        measureText: (text: string) => ({ width: text.length * 8 }),
      }),
    }),
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('pinned figures', () => {
  test('the lane leaves a readable column, or is not offered at all', () => {
    for (const width of [600, 994, 1262, 1600]) {
      const lane = pinnedLaneWidth(width)!;
      expect(lane).toBeGreaterThanOrEqual(PIN_MIN_WIDTH);
      expect(width - lane - PIN_GAP).toBeGreaterThanOrEqual(COLUMN_MIN_WIDTH);
    }
    expect(pinnedLaneWidth(292)).toBeNull();
    expect(pinnedLaneWidth(PIN_MIN_WIDTH + PIN_GAP + COLUMN_MIN_WIDTH - 1)).toBeNull();
  });

  test('a pinned card is not an obstacle in the text area', () => {
    const positions: FigurePosition[] = [
      { x: 0, y: 0, width: 400, height: 300, inline: false, pinned: true },
      { x: 300, y: 100, width: 200, height: 150, inline: false },
    ];
    const rects = toObstacleRects(positions, 600);
    expect(rects).toHaveLength(1);
    expect(rects[0].figureIndex).toBe(1);
  });

  test('text keeps its full width beside a pinned card, and nothing is pushed down', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: words(80) },
      { type: 'richBlock', node: { type: 'math' }, estimatedHeight: 60 },
      { type: 'paragraph', words: words(80) },
    ];
    const free = layoutBlocks(blocks, [], 500, 0, style);
    const { layout, positions } = layoutWithFigures(
      blocks,
      [{ x: 0, y: 0, width: 300, height: 900, inline: false, pinned: true }],
      500,
      style,
      { count: 1, gap: 32 },
    );
    expect(layout.contentBottom).toBe(free.contentBottom);
    expect(layout.spans.map((span) => [span.x, span.y])).toEqual(
      free.spans.map((span) => [span.x, span.y]),
    );
    expect(positions[0]).toMatchObject({ pinned: true, width: 300 });
  });
});
