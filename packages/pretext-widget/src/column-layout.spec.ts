/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { buildInitialFigurePositions } from './figure-layout.js';
import { layoutBlocksInColumns } from './column-layout.js';
import { collectBlocks, layoutBlocks } from './layout.js';
import type { ContentBlock, StyledWord, TextStyle } from './layout.js';
import type { FigureInfo } from './model.js';

const STYLE: TextStyle = {
  fontSize: 16,
  lineHeight: 26,
  paragraphGap: 20,
  fontFamily: 'serif',
  fontWeight: '400',
  color: '#111827',
};

function words(count: number): StyledWord[] {
  return Array.from({ length: count }, (_, index) => ({
    text: `word-${index}`,
    bold: false,
    italic: false,
    code: false,
    spaceAfter: true,
  }));
}

function taggedWords(prefix: string, count: number): StyledWord[] {
  return words(count).map((word, index) => ({ ...word, text: `${prefix}-${index}` }));
}

beforeAll(() => {
  const context = {
    font: '',
    measureText: (text: string) => ({ width: text.length * 7.5 }),
  } as unknown as CanvasRenderingContext2D;
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => context }),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('multi-column paper flow', () => {
  test('places figures and equations inside column frames', () => {
    const mathNode = { type: 'math', value: 'x^2 + y^2' };
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: words(64) },
      { type: 'figureAnchor', figureIndex: 0 },
      { type: 'richBlock', node: mathNode, estimatedHeight: 96 },
      { type: 'paragraph', words: words(80) },
    ];
    const result = layoutBlocksInColumns(
      blocks,
      [
        {
          left: 0,
          top: 0,
          right: 820,
          bottom: 170,
          figureIndex: 0,
          inline: true,
        },
      ],
      820,
      0,
      STYLE,
      { count: 2, gap: 20, columnHeight: 280, bandGap: 24 },
    );

    expect(result.figureAnchors).toHaveLength(1);
    expect(result.figureAnchors[0].width).toBe(400);
    expect([0, 420]).toContain(result.figureAnchors[0].x);
    expect(result.richBlocks).toHaveLength(1);
    expect(result.richBlocks[0]).toMatchObject({ width: 400, node: mathNode });
    expect([0, 420]).toContain(result.richBlocks[0].x);
    expect(result.spans.some((span) => span.x >= 420)).toBe(true);
  });

  test('sizes an inline figure to its paper column instead of full width', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: words(12) },
      { type: 'figureAnchor', figureIndex: 0 },
      { type: 'paragraph', words: words(12) },
    ];
    const figures: FigureInfo[] = [
      {
        label: 'Figure 1',
        imageUrl: null,
        mdastNode: {
          type: 'container',
          children: [{ type: 'image', url: '/figure.png' }],
        },
      },
    ];

    const [position] = buildInitialFigurePositions(
      blocks,
      figures,
      820,
      { 0: 0.5 },
      { count: 2, gap: 20, columnHeight: 400, bandGap: 24 },
    );

    expect(position.width).toBe(400);
    expect([0, 420]).toContain(position.x);
    expect(position.inline).toBe(true);
  });

  test('splits a paragraph to use the remaining column height', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: words(110) },
      { type: 'paragraph', words: words(110) },
    ];
    const result = layoutBlocksInColumns(blocks, [], 820, 0, STYLE, {
      count: 2,
      gap: 20,
      columnHeight: 180,
      bandGap: 24,
    });

    const leftColumnBottom = Math.max(
      ...result.spans.filter((span) => span.x < 400).map((span) => span.y),
    );
    expect(leftColumnBottom).toBeGreaterThanOrEqual(130);
    expect(result.spans.some((span) => span.x >= 420)).toBe(true);
  });

  test('uses all three column frames when the reading area is wide enough', () => {
    const result = layoutBlocksInColumns(
      [{ type: 'paragraph', words: words(420) }],
      [],
      1060,
      0,
      STYLE,
      { count: 3, gap: 20, columnHeight: 220, bandGap: 24 },
    );

    expect(result.spans.some((span) => span.x < 340)).toBe(true);
    expect(result.spans.some((span) => span.x >= 360 && span.x < 700)).toBe(true);
    expect(result.spans.some((span) => span.x >= 720)).toBe(true);
  });

  test('floats an inline figure forward while prose fills the current column', () => {
    const blocks: ContentBlock[] = [
      { type: 'paragraph', words: taggedWords('before', 22) },
      { type: 'figureAnchor', figureIndex: 0 },
      { type: 'paragraph', words: taggedWords('after', 24) },
    ];
    const result = layoutBlocksInColumns(
      blocks,
      [
        {
          left: 0,
          top: 0,
          right: 400,
          bottom: 150,
          figureIndex: 0,
          inline: true,
        },
      ],
      820,
      0,
      STYLE,
      { count: 2, gap: 20, columnHeight: 220, bandGap: 24 },
    );

    expect(result.figureAnchors[0]).toMatchObject({ x: 420, y: 0 });
    expect(result.spans.some((span) => span.x < 400 && span.text.startsWith('after-'))).toBe(true);
  });

  test('does not double-count a figure anchor offset as figure height', () => {
    const result = layoutBlocksInColumns(
      [
        { type: 'paragraph', words: taggedWords('before', 18) },
        { type: 'figureAnchor', figureIndex: 0 },
        { type: 'paragraph', words: taggedWords('after', 12) },
      ],
      [
        {
          left: 0,
          top: 0,
          right: 400,
          bottom: 140,
          figureIndex: 0,
          inline: true,
        },
      ],
      820,
      0,
      STYLE,
      { count: 2, gap: 20, columnHeight: 400, bandGap: 24 },
    );

    const anchor = result.figureAnchors[0];
    const following = result.spans.find((span) => span.text === 'after-0');
    // Balancing may float the card into the other column. In its own column,
    // however, the first following line must clear precisely the card height.
    const below = result.spans.find((span) => span.x >= anchor.x && span.y >= anchor.y + 140);
    if (following?.x === anchor.x) {
      expect(following?.y).toBe(anchor.y + 140 + STYLE.paragraphGap);
    }
    if (below) expect(below.y).toBeGreaterThanOrEqual(anchor.y + 140 + STYLE.paragraphGap);
    expect(result.contentBottom).toBeLessThan(400);
  });

  test('moves an orphan heading with its following figure', () => {
    const heading: ContentBlock = {
      type: 'heading',
      depth: 2,
      words: taggedWords('heading', 2),
      headingId: 'next-section',
      headingTitle: 'Next section',
    };
    const result = layoutBlocksInColumns(
      [
        { type: 'paragraph', words: taggedWords('before', 38) },
        heading,
        { type: 'figureAnchor', figureIndex: 0 },
        { type: 'paragraph', words: taggedWords('after', 8) },
      ],
      [
        {
          left: 0,
          top: 0,
          right: 400,
          bottom: 160,
          figureIndex: 0,
          inline: true,
        },
      ],
      820,
      0,
      STYLE,
      { count: 2, gap: 20, columnHeight: 250, bandGap: 24 },
    );

    const headingSpan = result.spans.find((span) => span.text === 'heading-0');
    const anchor = result.figureAnchors[0];
    expect(headingSpan?.x).toBe(anchor.x);
    expect(anchor.y).toBeGreaterThan(headingSpan?.y ?? Number.POSITIVE_INFINITY);
  });

  test('reanchors an inline figure after an upstream measurement changes', () => {
    const result = layoutBlocks(
      [{ type: 'figureAnchor', figureIndex: 0 }],
      [
        {
          left: 0,
          top: 240,
          right: 400,
          bottom: 340,
          figureIndex: 0,
          inline: true,
        },
      ],
      400,
      200,
      STYLE,
    );
    expect(result.contentBottom).toBe(320);
  });

  test('reserves figure height from its anchor when sizing obstacles start at zero', () => {
    const result = layoutBlocks(
      [
        { type: 'paragraph', words: taggedWords('before', 12) },
        { type: 'figureAnchor', figureIndex: 0 },
        {
          type: 'heading',
          depth: 2,
          words: taggedWords('heading', 2),
          headingId: 'h',
          headingTitle: 'Heading',
        },
      ],
      [
        {
          left: 0,
          top: 0,
          right: 400,
          bottom: 180,
          figureIndex: 0,
          inline: true,
        },
      ],
      400,
      0,
      STYLE,
    );
    const anchor = result.figureAnchors[0];
    const heading = result.headingAnchors[0];
    expect(heading.y).toBeGreaterThanOrEqual(anchor.y + 180 + STYLE.paragraphGap);
  });

  test('uses measured inline math width to prevent following words from overlapping', () => {
    const result = layoutBlocks(
      [
        {
          type: 'paragraph',
          words: [
            {
              text: 'f(x)',
              bold: false,
              italic: false,
              code: false,
              math: true,
              measuredWidth: 380,
              spaceAfter: true,
            },
            {
              text: 'after',
              bold: false,
              italic: false,
              code: false,
            },
          ],
        },
      ],
      [],
      400,
      0,
      STYLE,
    );
    const after = result.spans.find((span) => span.text === 'after');
    expect(after?.y).toBe(STYLE.lineHeight);
  });

  test('keeps an over-wide inline formula instead of dropping it', () => {
    const result = layoutBlocks(
      [
        {
          type: 'paragraph',
          words: [
            {
              text: String.raw`\sum_{i=1}^{1000} x_i`,
              bold: false,
              italic: false,
              code: false,
              math: true,
              measuredWidth: 760,
            },
          ],
        },
      ],
      [],
      400,
      0,
      STYLE,
    );

    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]).toMatchObject({ math: true, maxWidth: 400 });
  });

  test('reserves later bands occupied by an indivisible tall block', () => {
    const result = layoutBlocksInColumns(
      [
        {
          type: 'richBlock',
          node: { type: 'table' },
          estimatedHeight: 450,
          richBlockIndex: 0,
        },
        { type: 'paragraph', words: taggedWords('after', 220) },
      ],
      [],
      820,
      0,
      STYLE,
      { count: 2, gap: 20, columnHeight: 200, bandGap: 24 },
    );

    const laterLeftColumnWords = result.spans.filter(
      (span) => span.x < 400 && span.text.startsWith('after-'),
    );
    expect(laterLeftColumnWords.length).toBeGreaterThan(0);
    expect(Math.min(...laterLeftColumnWords.map((span) => span.y))).toBeGreaterThanOrEqual(450);
  });

  test('keeps tables and code while flattening a long admonition into the column flow', () => {
    const blocks = collectBlocks({
      type: 'root',
      children: [
        {
          type: 'admonition',
          children: [
            { type: 'admonitionTitle', children: [{ type: 'text', value: 'Theorem' }] },
            { type: 'paragraph', children: [{ type: 'text', value: 'Statement text' }] },
            { type: 'math', value: 'x^2' },
          ],
        },
        {
          type: 'container',
          kind: 'table',
          children: [
            {
              type: 'table',
              children: [{ type: 'tableRow', children: [] }],
            },
          ],
        },
        { type: 'code', value: 'line 1\nline 2' },
      ],
    });

    expect(blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'paragraph',
      'richBlock',
      'richBlock',
      'richBlock',
    ]);
    expect(blocks.filter((block) => block.type === 'richBlock')).toHaveLength(3);
  });
});
