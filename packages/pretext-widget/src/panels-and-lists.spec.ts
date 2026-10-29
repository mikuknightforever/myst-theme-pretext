import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { layoutBlocks, DEFAULT_TEXT_STYLE, type StyledWord } from './layout.js';

const CHAR = 8;
const word = (text: string): StyledWord => ({
  text,
  bold: false,
  italic: false,
  code: false,
  spaceAfter: true,
});
const words = (text: string) => text.split(' ').map(word);
const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 24, paragraphGap: 16 };

beforeAll(() => {
  const context = { font: '', measureText: (text: string) => ({ width: text.length * CHAR }) };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('abstract box', () => {
  test('a shaded box spans the column, with its text inset inside it', () => {
    const result = layoutBlocks(
      [
        { type: 'paragraph', words: words('Abstract text'), panel: 'abstract' },
        { type: 'paragraph', words: words('More abstract'), panel: 'abstract' },
        { type: 'paragraph', words: words('Body') },
      ],
      [],
      400,
      0,
      style,
    );
    expect(result.panels).toHaveLength(1);
    const [box] = result.panels!;
    expect(box).toMatchObject({ panel: 'abstract', x: 0, width: 400, top: 0 });
    const inside = result.spans.filter((span) => span.text !== 'Body');
    for (const span of inside) {
      expect(span.x).toBeGreaterThanOrEqual(20);
      expect(span.y).toBeGreaterThan(box.top);
      expect(span.y + 24).toBeLessThan(box.bottom);
    }
    const body = result.spans.find((span) => span.text === 'Body')!;
    expect(body.x).toBe(0);
    expect(body.y).toBeGreaterThan(box.bottom);
  });

  test('a layout without an abstract has no boxes', () => {
    const result = layoutBlocks([{ type: 'paragraph', words: words('Body') }], [], 400, 0, style);
    expect(result.panels).toBeUndefined();
  });
});

describe('list layout', () => {
  test('nested items indent by level and later lines hang past the marker', () => {
    const result = layoutBlocks(
      [
        { type: 'listItem', bullet: true, marker: '1.', depth: 0, words: words('Outer') },
        {
          type: 'listItem',
          bullet: true,
          marker: '•',
          depth: 1,
          words: words('aaaa bbbb cccc dddd eeee ffff'),
        },
        { type: 'listItem', bullet: false, marker: '•', depth: 1, words: words('Second') },
      ],
      [],
      120,
      0,
      style,
    );
    const at = (text: string) => result.spans.find((span) => span.text === text)!;
    expect(at('1.').x).toBe(0);
    expect(at('Outer').x).toBeGreaterThan(0);
    expect(at('•').x).toBe(24);
    // The wrapped line and the item's later paragraph start where its first word does.
    const firstWord = at('aaaa').x;
    const wrapped = result.spans.filter((span) => span.y > at('aaaa').y && span.text !== 'Second');
    expect(wrapped.length).toBeGreaterThan(0);
    expect(wrapped[0].x).toBe(firstWord);
    expect(at('Second').x).toBe(firstWord);
  });

  test('items of a list sit closer together than paragraphs', () => {
    const item = (text: string) => ({ type: 'listItem' as const, bullet: true, words: words(text) });
    const result = layoutBlocks(
      [item('One'), item('Two'), { type: 'paragraph', words: words('After') }],
      [],
      400,
      0,
      style,
    );
    const y = (text: string) => result.spans.find((span) => span.text === text)!.y;
    expect(y('Two') - y('One')).toBe(24 + 6);
    expect(y('After') - y('Two')).toBe(24 + 16);
  });
});
