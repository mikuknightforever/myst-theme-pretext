/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { layoutBlocksInColumns } from './column-layout.js';
import { DEFAULT_TEXT_STYLE, layoutBlocks, type ContentBlock, type StyledWord } from './layout.js';

const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 26, paragraphGap: 20 };
const words = (count: number, prefix = 'word'): StyledWord[] =>
  Array.from({ length: count }, (_, i) => ({
    text: `${prefix}${i}`,
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

test('a continuing paragraph does not pay paragraph spacing at each provisional cut', () => {
  const parts: ContentBlock[] = [
    { type: 'paragraph', words: words(1), continues: true },
    { type: 'paragraph', words: words(1, 'next') },
  ];
  const result = layoutBlocks(parts, [], 400, 0, style);
  expect(result.spans[1].y).toBe(style.lineHeight);
  expect(result.contentBottom).toBe(2 * style.lineHeight + style.paragraphGap);
});

test.each([2, 3] as const)(
  '%i columns balance prose and compact every band without losing reading order',
  (count) => {
    const source = words(900);
    const width = 400 * count + 20 * (count - 1);
    const result = layoutBlocksInColumns(
      [{ type: 'paragraph', words: source }],
      [],
      width,
      40,
      style,
      { count, gap: 20, columnHeight: 393, bandGap: 12 },
    );
    const bands = result.columnBands!;
    expect(bands.length).toBeGreaterThan(2);
    expect(bands[0].top).toBe(40);
    const readingOrder: string[] = [];
    bands.forEach((band, i) => {
      if (i) expect(band.top - bands[i - 1].bottom).toBe(12);
      const bottoms: number[] = [];
      for (let col = 0; col < count; col++) {
        const spans = result.spans
          .filter(
            (s) =>
              s.y >= band.top && s.y < band.bottom && s.x >= col * 420 && s.x < col * 420 + 400,
          )
          .sort((a, b) => a.y - b.y || a.x - b.x);
        readingOrder.push(...spans.map((s) => s.text));
        if (spans.length) bottoms.push(Math.max(...spans.map((s) => s.y + (s.height ?? 26))));
      }
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(2 * style.lineHeight);
    });
    expect(readingOrder).toEqual(source.map((w) => w.text));
  },
);

test('short equation lead-ins stay with the equation across band breaks', () => {
  const result = layoutBlocksInColumns(
    [
      { type: 'paragraph', words: words(75) },
      { type: 'paragraph', words: words(3, 'lead') },
      { type: 'richBlock', node: { type: 'math' }, estimatedHeight: 160, richBlockIndex: 0 },
      { type: 'paragraph', words: words(80, 'after') },
    ],
    [],
    820,
    0,
    style,
    { count: 2, gap: 20, columnHeight: 300 },
  );
  const lead = result.spans.find((s) => s.text === 'lead0')!;
  const equation = result.richBlocks[0];
  expect(lead.x).toBe(equation.x);
  expect(equation.y - lead.y).toBe(style.lineHeight + style.paragraphGap);
});

test.each([2, 3] as const)(
  '%i columns retain every block and keep tall figures/tables inside band extents',
  (count) => {
    const blocks: ContentBlock[] = [];
    for (let i = 0; i < 12; i++) {
      blocks.push({ type: 'paragraph', words: words(35 + i * 7, `p${i}-`) });
      blocks.push({
        type: 'richBlock',
        node: { type: i % 2 ? 'math' : 'table' },
        estimatedHeight: i === 4 ? 730 : 70 + i * 5,
        richBlockIndex: i,
      });
    }
    const result = layoutBlocksInColumns(blocks, [], 1260, 0, style, {
      count,
      gap: 20,
      columnHeight: 400,
    });
    expect(result.spans.length).toBe(
      blocks.reduce((sum, b) => sum + ('words' in b ? b.words.length : 0), 0),
    );
    expect(result.richBlocks.map((b) => b.richBlockIndex)).toEqual(
      Array.from({ length: 12 }, (_, i) => i),
    );
    for (const rich of result.richBlocks) {
      const band = result.columnBands!.find((b) => rich.y >= b.top && rich.y < b.bottom)!;
      expect(rich.y + rich.estimatedHeight).toBeLessThanOrEqual(band.bottom);
      for (const span of result.spans.filter((s) => s.x >= rich.x && s.x < rich.x + rich.width)) {
        expect(
          span.y + (span.height ?? 26) <= rich.y || span.y >= rich.y + rich.estimatedHeight,
        ).toBe(true);
      }
    }
  },
);
