import { createHash } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { collectArticle, DEFAULT_TEXT_STYLE } from './layout.js';
import { buildInitialFigurePositions, layoutWithFigures } from './figure-layout.js';
import type { ColumnCount } from './column-layout.js';

const paragraph = (index: number) => ({
  type: 'paragraph',
  children: [
    {
      type: 'text',
      value: `Section ${index} explains ordinary words and their ordering. `.repeat(14),
    },
    { type: 'inlineMath', value: 'x^2+y^2', html: '<span>x²+y²</span>' },
    { type: 'text', value: ' followed by a ' },
    { type: 'link', url: '#section-1', children: [{ type: 'text', value: 'reference' }] },
    { type: 'text', value: '.' },
  ],
});

const source = {
  type: 'root',
  children: Array.from({ length: 6 }, (_, i) => [
    {
      type: 'heading',
      depth: 2,
      identifier: `section-${i}`,
      children: [{ type: 'text', value: `Section ${i}` }],
    },
    paragraph(i),
    {
      type: 'container',
      kind: 'figure',
      children: [
        { type: 'image', url: `figure-${i}.svg`, width: 400, height: 150 + i * 50 },
        { type: 'caption', children: [{ type: 'text', value: `Caption ${i}` }] },
      ],
    },
    { type: 'math', value: 'f(x)=x^2' },
    paragraph(i + 10),
  ]).flat(),
};

beforeAll(() => {
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ font: '', measureText: (s: string) => ({ width: s.length * 7.5 }) }),
    }),
  });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('pre-refactor geometry contract', () => {
  it.each([1, 2, 3] as const)(
    'preserves complete geometry for %i columns and font sizes',
    (count: ColumnCount) => {
      const before = JSON.stringify(source);
      for (const fontSize of [16, 20]) {
        const { blocks, figures } = collectArticle(source);
        const style = { ...DEFAULT_TEXT_STYLE, fontSize, lineHeight: fontSize + 10 };
        const options = { count, gap: 32, columnHeight: 700, bandGap: 24 };
        const positions = buildInitialFigurePositions(blocks, figures, 1200, {}, options, style);
        const result = layoutWithFigures(blocks, positions, 1200, style, options);
        // Hash the ENTIRE result, not only counts: every word position, figure,
        // equation, column break and content extent must match the pre-split code.
        expect(createHash('sha256').update(JSON.stringify(result)).digest('hex')).toMatchSnapshot(
          `font-${fontSize}`,
        );
      }
      expect(JSON.stringify(source)).toBe(before);
    },
  );
});
