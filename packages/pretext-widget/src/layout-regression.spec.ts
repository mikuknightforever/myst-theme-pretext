/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { layoutBlocks, DEFAULT_TEXT_STYLE, type ContentBlock, type StyledWord } from './layout.js';
import {
  buildInitialFigurePositions,
  getFigureDisplaySize,
  layoutWithFigures,
  toObstacleRects,
} from './figure-layout.js';
import { layoutBlocksInColumns } from './column-layout.js';

const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 26, paragraphGap: 20 };
const word = (text: string, extra = {}): StyledWord => ({
  text,
  bold: false,
  italic: false,
  code: false,
  spaceAfter: true,
  ...extra,
});
beforeAll(() => {
  const context = {
    font: '',
    measureText(text: string) {
      return { width: text.length * (this.font.includes('700') ? 12 : 8) };
    },
  };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('layout geometry regressions', () => {
  test('scales both intrinsic image dimensions to the column and measures captions', () => {
    const figure = {
      label: 'Figure',
      imageUrl: null,
      mdastNode: {
        children: [
          { type: 'image', width: 1600, height: 800 },
          { type: 'caption', children: [] },
        ],
      },
    };
    expect(getFigureDisplaySize(figure, 400, undefined, 90)).toEqual({ width: 400, height: 290 });
    expect(getFigureDisplaySize(figure, 90).width).toBeLessThanOrEqual(90);
  });
  test('a token taller than a band terminates and preserves following text', () => {
    const result = layoutBlocksInColumns(
      [
        {
          type: 'paragraph',
          words: [
            word('tall', { math: true, measuredWidth: 900, measuredHeight: 600 }),
            word('following'),
          ],
        },
      ],
      [],
      820,
      0,
      style,
      { count: 2, gap: 20, columnHeight: 300 },
    );
    expect(result.spans).toHaveLength(2);
    expect(result.spans[1].x).toBeGreaterThanOrEqual(420);
  });

  test.each([1, 2, 3] as const)(
    '%i columns commit figures and remeasured prose atomically',
    (count) => {
      const blocks: ContentBlock[] = [
        { type: 'richBlock', node: { type: 'math' }, estimatedHeight: 80, richBlockIndex: 0 },
        { type: 'figureAnchor', figureIndex: 0 },
        { type: 'paragraph', words: [word('following')] },
      ];
      const positions = [{ x: 0, y: 900, width: 300, height: 120, inline: true }];
      const result = layoutWithFigures(blocks, positions, 1200, style, {
        count,
        gap: 24,
        columnHeight: 500,
      });
      expect(result.positions[0].y).toBe(result.layout.figureAnchors[0].y);
      const figure = result.positions[0];
      const following = result.layout.spans[0];
      if (count === 1) {
        expect(following.y).toBe(figure.y + 140);
        expect(figure.y).toBe(100);
      } else {
        expect(
          following.x < figure.x ||
            following.x >= figure.x + figure.width ||
            following.y >= figure.y + figure.height + style.paragraphGap,
        ).toBe(true);
      }
    },
  );
  test('an over-wide token starts on the current line and reserves its scrollbar', () => {
    const result = layoutBlocks(
      [
        {
          type: 'paragraph',
          words: [word('formula', { math: true, measuredWidth: 900 }), word('following')],
        },
      ],
      [],
      400,
      0,
      style,
    );
    expect(result.spans[0].y).toBe(0);
    expect(result.spans[1].y).toBeGreaterThanOrEqual(style.lineHeight + 16);
  });

  test('a tall inline formula reserves vertical space for the next line', () => {
    const result = layoutBlocks(
      [
        {
          type: 'paragraph',
          words: [
            word('fraction', { math: true, measuredWidth: 390, measuredHeight: 64 }),
            word('following'),
          ],
        },
      ],
      [],
      400,
      0,
      style,
    );
    expect(result.spans[1].y).toBeGreaterThanOrEqual(64);
  });

  test('bold and regular text do not share an incorrect cached width', () => {
    layoutBlocks([{ type: 'paragraph', words: [word('cacheprobe')] }], [], 400, 0, style);
    const result = layoutBlocks(
      [{ type: 'paragraph', words: [word('cacheprobe', { bold: true }), word('following')] }],
      [],
      400,
      0,
      style,
    );
    expect(result.spans[1].x).toBeGreaterThanOrEqual(120);
  });

  test.each(['heading', 'richBlock'] as const)('%s avoids a manually moved figure', (type) => {
    const block: ContentBlock =
      type === 'heading'
        ? { type, depth: 2, words: [word('Heading')], headingId: 'h', headingTitle: 'Heading' }
        : { type, node: { type: 'math', value: 'x=1' }, estimatedHeight: 100 };
    const result = layoutBlocks(
      [block],
      [{ left: 100, right: 300, top: 0, bottom: 180, inline: false }],
      400,
      0,
      style,
    );
    const y = type === 'heading' ? result.spans[0].y : result.richBlocks[0].y;
    expect(y).toBeGreaterThanOrEqual(180);
  });

  test('inline figure flow uses its height, not a stale position from the previous pass', () => {
    const result = layoutBlocks(
      [
        { type: 'figureAnchor', figureIndex: 0 },
        { type: 'paragraph', words: [word('following')] },
      ],
      [{ left: 0, right: 400, top: 800, bottom: 900, inline: true, figureIndex: 0 }],
      400,
      0,
      style,
    );
    expect(result.spans[0].y).toBe(120);
  });

  test('opening-layout cache respects the requested column band height', () => {
    // A short final tail can legitimately balance to the same result at both
    // preferred heights. Use several bands to observe cache-key independence.
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: Array.from({ length: 500 }, () => word('paragraph')) },
      { type: 'figureAnchor', figureIndex: 0 },
    ];
    const figures = [{ label: 'Figure', imageUrl: null, mdastNode: { children: [] } }];
    const a = buildInitialFigurePositions(
      blocks,
      figures,
      820,
      {},
      { count: 2, gap: 20, columnHeight: 260 },
      style,
    );
    const b = buildInitialFigurePositions(
      blocks,
      figures,
      820,
      {},
      { count: 2, gap: 20, columnHeight: 980 },
      style,
    );
    expect(a[0]).not.toEqual(b[0]);
  });

  test.each([1, 2, 3] as const)(
    '%i columns preserve all prose without crossing inline figures',
    (count) => {
      const blocks: ContentBlock[] = [];
      const figures = Array.from({ length: 8 }, (_, i) => ({
        label: `Figure ${i}`,
        imageUrl: null,
        mdastNode: { children: [] },
      }));
      for (let i = 0; i < 8; i++) {
        blocks.push({
          type: 'paragraph',
          words: Array.from({ length: 70 }, (_, j) => word(`p${i}w${j}`)),
        });
        blocks.push({ type: 'figureAnchor', figureIndex: i });
      }
      const options = { count, gap: 24, columnHeight: 450 };
      const positions = buildInitialFigurePositions(blocks, figures, 1200, {}, options, style);
      const result = layoutBlocksInColumns(
        blocks,
        toObstacleRects(positions, 1200),
        1200,
        0,
        style,
        options,
      );
      expect(result.spans).toHaveLength(560);
      for (const span of result.spans) {
        for (const figure of positions) {
          if (span.x >= figure.x && span.x < figure.x + figure.width) {
            expect(
              span.y + span.style.lineHeight <= figure.y || span.y >= figure.y + figure.height,
            ).toBe(true);
          }
        }
      }
    },
  );
});
