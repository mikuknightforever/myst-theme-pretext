/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { layoutBlocksInColumns } from './column-layout.js';
import {
  DEFAULT_TEXT_STYLE,
  layoutBlocks,
  type ContentBlock,
  type LayoutResult,
  type ObstacleRect,
  type StyledWord,
} from './layout.js';

const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 26, paragraphGap: 20 };
const words = (count: number, prefix: string, height = 26): StyledWord[] =>
  Array.from({ length: count }, (_, i) => ({
    text: `${prefix}-${i}`,
    bold: false,
    italic: false,
    code: false,
    spaceAfter: true,
    measuredWidth: 48,
    measuredHeight: height,
  }));
const paragraph = (count: number, prefix: string): ContentBlock => ({
  type: 'paragraph',
  words: words(count, prefix),
});
const heading = (id: string): ContentBlock => ({
  type: 'heading',
  depth: 3,
  words: words(3, id),
  headingId: id,
  headingTitle: id,
});
const rich = (i: number, height: number, type = 'math'): ContentBlock => ({
  type: 'richBlock',
  richBlockIndex: i,
  estimatedHeight: height,
  node: { type },
});
const figure = (i: number): ContentBlock => ({ type: 'figureAnchor', figureIndex: i });
const obstacle = (i: number, height: number): ObstacleRect => ({
  figureIndex: i,
  inline: true,
  left: 0,
  right: 400,
  top: 0,
  bottom: height,
});

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ font: '', measureText: (s: string) => ({ width: s.length * 8 }) }),
    }),
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function physicalWords(result: LayoutResult, count: number, width: number) {
  const frame = (width - 20 * (count - 1)) / count;
  const out: string[] = [];
  for (const band of result.columnBands!)
    for (let col = 0; col < count; col++) {
      out.push(
        ...result.spans
          .filter(
            (s) =>
              s.y >= band.top &&
              s.y < band.bottom &&
              s.x >= col * (frame + 20) &&
              s.x < col * (frame + 20) + frame,
          )
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((s) => s.text),
      );
    }
  return out;
}

test('a heading followed by a float uses available prose instead of reserving the entire figure', () => {
  const blocks = [paragraph(160, 'before'), heading('section'), figure(0), paragraph(350, 'after')];
  const result = layoutBlocksInColumns(blocks, [obstacle(0, 316)], 820, 0, style, {
    count: 2,
    gap: 20,
    columnHeight: 980,
  });
  const h = result.spans.find((s) => s.text === 'section-0')!;
  const f = result.figureAnchors[0];
  const next = result.spans.find((s) => s.text === 'after-0')!;
  expect(h.x).toBe(0);
  expect(next.x).toBe(h.x);
  expect(next.y).toBeGreaterThan(h.y);
  expect(f.x).toBe(420);
  expect(
    Math.max(...result.columnBands![0].columnBottoms) -
      Math.min(...result.columnBands![0].columnBottoms),
  ).toBeLessThanOrEqual(52);
});

test('a heading cannot borrow prose from a different section to justify an orphan', () => {
  const result = layoutBlocksInColumns(
    [
      paragraph(100, 'before'),
      heading('first'),
      figure(0),
      heading('second'),
      paragraph(80, 'after'),
    ],
    [obstacle(0, 180)],
    820,
    0,
    style,
    { count: 2, gap: 20, columnHeight: 500 },
  );
  const h = result.spans.find((s) => s.text === 'first-0')!;
  const f = result.figureAnchors[0];
  expect(f.x).toBe(h.x);
  expect(f.y).toBeGreaterThan(h.y);
});

test('two actual lead-in lines stay with an equation even when inline math adds a pixel', () => {
  const lead: ContentBlock = { type: 'paragraph', words: words(12, 'lead', 27) };
  const result = layoutBlocksInColumns(
    [paragraph(58, 'before'), lead, rich(0, 100), paragraph(150, 'after')],
    [],
    820,
    0,
    style,
    { count: 2, gap: 20, columnHeight: 400 },
  );
  const start = result.spans.find((s) => s.text === 'lead-0')!;
  const last = result.spans.find((s) => s.text === 'lead-11')!;
  expect(last.x).toBeLessThan(start.x + 400);
  expect(result.richBlocks[0].x).toBe(start.x);
  expect(result.richBlocks[0].y).toBeGreaterThan(last.y);
});

test('strict equations pay one measured block height and one trailing separation', () => {
  const result = layoutBlocks(
    [paragraph(1, 'before'), rich(0, 41), paragraph(1, 'after')],
    [],
    400,
    0,
    style,
  );
  expect(result.richBlocks[0].y).toBe(46);
  expect(result.spans.find((s) => s.text === 'after-0')!.y).toBe(46 + 41 + 20);
});

test('an oversized companion does not leave its heading or short introduction behind', () => {
  for (const blocks of [
    [heading('title'), figure(0), heading('next-section'), paragraph(130, 'after')],
    [paragraph(3, 'lead'), rich(0, 780), paragraph(130, 'after')],
  ]) {
    const result = layoutBlocksInColumns(blocks, [obstacle(0, 780)], 820, 0, style, {
      count: 2,
      gap: 20,
      columnHeight: 400,
    });
    const first = result.spans[0];
    const object = result.figureAnchors[0] ?? result.richBlocks[0];
    expect(object.x).toBe(first.x);
    expect(object.y).toBeGreaterThan(first.y);
    expect(result.columnBands![0].bottom).toBeGreaterThanOrEqual(object.y + 780);
  }
});

test.each([2, 3] as const)(
  '%i columns preserve every source token and object through rolling band boundaries',
  (count) => {
    for (let seed = 1; seed <= 16; seed++) {
      let state = seed;
      const rand = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const width = count * (320 + seed * 9) + (count - 1) * 20;
      const localStyle = {
        ...style,
        fontSize: 14 + (seed % 9),
        lineHeight: 24 + (seed % 9),
        paragraphGap: 12 + (seed % 5) * 4,
      };
      const blocks: ContentBlock[] = [];
      const obstacles: ObstacleRect[] = [];
      let ri = 0,
        fi = 0;
      for (let i = 0; i < 20; i++) {
        if (i % 5 === 0) blocks.push(heading(`h${i}`));
        blocks.push(paragraph(5 + Math.floor(rand() * 100), `s${seed}p${i}`));
        if (i % 3 === 0) {
          blocks.push(figure(fi));
          obstacles.push(obstacle(fi++, 80 + Math.floor(rand() * 600)));
        } else blocks.push(rich(ri++, 30 + Math.floor(rand() * 200), i % 4 ? 'math' : 'iframe'));
      }
      const expected = blocks.flatMap((b) => ('words' in b ? b.words.map((w) => w.text) : []));
      const result = layoutBlocksInColumns(blocks, obstacles, width, 0, localStyle, {
        count,
        gap: 20,
        columnHeight: 400 + seed * 7,
      });
      expect(physicalWords(result, count, width)).toEqual(expected);
      expect(result.figureAnchors.map((f) => f.figureIndex).sort((a, b) => a - b)).toEqual(
        Array.from({ length: fi }, (_, i) => i),
      );
      expect(result.richBlocks.map((r) => r.richBlockIndex).sort((a, b) => a - b)).toEqual(
        Array.from({ length: ri }, (_, i) => i),
      );
      const readingKey = (p: { x: number; y: number }) => {
        const band = result.columnBands!.findIndex((b) => p.y >= b.top && p.y < b.bottom);
        const frame = (width - 20 * (count - 1)) / count;
        return band * 1e8 + Math.floor(p.x / (frame + 20) + 0.001) * 1e6 + p.y;
      };
      expect(
        [...result.figureAnchors]
          .sort((a, b) => readingKey(a) - readingKey(b))
          .map((f) => f.figureIndex),
      ).toEqual(Array.from({ length: fi }, (_, i) => i));
      const strict = result.richBlocks.filter((r) => r.node.type !== 'iframe');
      expect(
        [...strict].sort((a, b) => readingKey(a) - readingKey(b)).map((r) => r.richBlockIndex),
      ).toEqual(strict.map((r) => r.richBlockIndex));
      const rects = [
        ...result.richBlocks.map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.estimatedHeight })),
        ...result.figureAnchors.map((f) => ({
          x: f.x,
          y: f.y,
          w: f.width,
          h: obstacles[f.figureIndex].bottom,
        })),
      ];
      for (const rect of rects) {
        const band = result.columnBands!.find((b) => rect.y >= b.top && rect.y < b.bottom)!;
        expect(rect.y + rect.h).toBeLessThanOrEqual(band.bottom);
        for (const span of result.spans.filter((s) => s.x >= rect.x && s.x < rect.x + rect.w)) {
          expect(
            span.y + (span.height ?? localStyle.lineHeight) <= rect.y || span.y >= rect.y + rect.h,
          ).toBe(true);
        }
      }
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i],
            b = rects[j];
          expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(
            true,
          );
        }
    }
  },
);
