/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { layoutBlocks, DEFAULT_TEXT_STYLE, type StyledWord, type WordSpan } from './layout.js';
import {
  normalizeReadingSettings,
  readingSettingsKey,
  readingTextStyle,
  DEFAULT_READING_SETTINGS,
} from './reading-settings.js';

const CHAR = 8;
const width = (text: string) => text.length * CHAR;
const word = (text: string): StyledWord => ({
  text,
  bold: false,
  italic: false,
  code: false,
  spaceAfter: true,
});
const paragraph = (text: string, extra = {}) => ({
  type: 'paragraph' as const,
  words: text.split(' ').map(word),
  ...extra,
});
const left = { ...DEFAULT_TEXT_STYLE, lineHeight: 24, paragraphGap: 16 };
const justified = { ...left, textAlign: 'justify' as const };

beforeAll(() => {
  const context = { font: '', measureText: (text: string) => ({ width: width(text) }) };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function lines(spans: WordSpan[]) {
  const byY = new Map<number, WordSpan[]>();
  for (const span of spans) byY.set(span.y, [...(byY.get(span.y) ?? []), span]);
  return [...byY.values()];
}
const rightEdge = (line: WordSpan[]) => line[line.length - 1].x + width(line[line.length - 1].text);
const TEXT =
  'the quick brown fox jumps over the lazy dog while seven wise owls quietly watch from old oak trees nearby';

describe('justified text', () => {
  test('every line but the last reaches the right edge; the last stays left aligned', () => {
    const result = layoutBlocks([paragraph(TEXT)], [], 200, 0, justified);
    const all = lines(result.spans);
    expect(all.length).toBeGreaterThan(3);
    for (const line of all.slice(0, -1)) expect(rightEdge(line)).toBeCloseTo(200, 5);
    const leftLines = lines(layoutBlocks([paragraph(TEXT)], [], 200, 0, left).spans);
    const last = (list: WordSpan[][]) => list[list.length - 1].map((span) => span.x);
    expect(last(all)).toEqual(last(leftLines));
  });

  test('line breaks and word widths are the same as left aligned', () => {
    const a = lines(layoutBlocks([paragraph(TEXT)], [], 200, 0, justified).spans);
    const b = lines(layoutBlocks([paragraph(TEXT)], [], 200, 0, left).spans);
    expect(a.map((line) => line.map((s) => s.text))).toEqual(
      b.map((line) => line.map((s) => s.text)),
    );
  });

  // Five 32px words fill 184px of a 200px line: 16px of slack over 4 gaps.
  const EVEN = Array.from({ length: 10 }, () => 'aaaa').join(' ');

  test('a paragraph continuing into the next column justifies its last line too', () => {
    const ending = lines(layoutBlocks([paragraph(EVEN)], [], 200, 0, justified).spans);
    expect(rightEdge(ending[0])).toBeCloseTo(200, 5);
    expect(rightEdge(ending[1])).toBeCloseTo(184, 5);
    const continuing = lines(
      layoutBlocks([paragraph(EVEN, { continues: true })], [], 200, 0, justified).spans,
    );
    for (const line of continuing) expect(rightEdge(line)).toBeCloseTo(200, 5);
  });

  test('only lines that would need gaps wider than 5 spaces stay left aligned', () => {
    // 'aa' + gap + 20 b's = 182px; 'cccc' does not fit, leaving 18px for one gap.
    const moderate = layoutBlocks([paragraph(`aa ${'b'.repeat(20)} cccc`)], [], 200, 0, justified);
    expect(rightEdge(lines(moderate.spans)[0])).toBeCloseTo(200, 5);
    // Short words in a wide column: no justified gap may exceed 5 spaces (30px).
    const sparse = layoutBlocks([paragraph(`aa bbbb ${'c'.repeat(24)} dd`)], [], 200, 0, justified);
    for (const line of lines(sparse.spans)) {
      for (let k = 1; k < line.length; k++) {
        expect(line[k].x - (line[k - 1].x + width(line[k - 1].text))).toBeLessThanOrEqual(30);
      }
    }
  });

  test('justified paragraphs choose line breaks for the whole paragraph, not greedily', () => {
    // Stretch needed per gap for each line but the last, from the chosen breaks.
    const badness = (texts: string[][], lineWidth: number) =>
      texts.slice(0, -1).reduce((sum, line) => {
        const natural = line.reduce((w, t) => w + width(t), 0) + 6 * (line.length - 1);
        return sum + ((lineWidth - natural) / Math.max(1, line.length - 1)) ** 2;
      }, 0);
    // Found by search: greedy breaking scores 13025 here, the optimum 4131.
    const words =
      'aaaaaaaaaa bb cccc ddd eee ffffffff ggggggggg hhhhh iiii jj kkkkkkkk llllllllll mmmmmmmmm nnnnnnnn ooooo pppp';
    const texts = (style: typeof left) =>
      lines(layoutBlocks([paragraph(words)], [], 170, 0, style).spans).map((l) =>
        l.map((s) => s.text),
      );
    const optimal = texts(justified);
    const greedy = texts(left);
    expect(optimal.flat()).toEqual(greedy.flat());
    expect(badness(optimal, 170)).toBeLessThan(badness(greedy, 170));
  });

  test('a paragraph split across columns keeps the same line breaks in each part', () => {
    const words =
      'aaaa bbbbbbbbb cc dddddd eeeeeee f gggggggggg hh iiiii jjjjjjjjjjjj kkk ll mmmmmmm n ooooooooo ppp';
    const block = paragraph(words);
    const whole = lines(layoutBlocks([block], [], 170, 0, justified).spans).map((l) =>
      l.map((s) => s.text),
    );
    const cut = whole[0].length + whole[1].length;
    const first = { ...block, words: block.words.slice(0, cut), continues: true };
    const rest = { ...block, words: block.words.slice(cut) };
    const parts = [
      ...lines(layoutBlocks([first], [], 170, 0, justified).spans),
      ...lines(layoutBlocks([rest], [], 170, 0, justified).spans),
    ].map((l) => l.map((s) => s.text));
    expect(parts).toEqual(whole);
  });

  test('headings are never justified', () => {
    const heading = {
      type: 'heading' as const,
      depth: 2,
      words: TEXT.split(' ').map(word),
      headingId: 'h',
      headingTitle: 'h',
    };
    const a = layoutBlocks([heading], [], 200, 0, justified).spans.map((s) => s.x);
    const b = layoutBlocks([heading], [], 200, 0, left).spans.map((s) => s.x);
    expect(a).toEqual(b);
  });

  test('text beside a figure is justified to the figure edge', () => {
    // The free segment ends 20px before the figure, at 190px.
    const figure = { left: 210, top: 0, right: 300, bottom: 1000 };
    const result = layoutBlocks(
      [paragraph(EVEN, { continues: true })],
      [figure],
      300,
      0,
      justified,
    );
    for (const line of lines(result.spans)) expect(rightEdge(line)).toBeCloseTo(190, 5);
  });
});

describe('alignment reading setting', () => {
  test('defaults to left, which leaves the text style and layout key unchanged', () => {
    expect(DEFAULT_READING_SETTINGS.textAlign).toBe('left');
    expect(readingTextStyle(DEFAULT_READING_SETTINGS).textAlign).toBeUndefined();
    expect(readingSettingsKey(DEFAULT_READING_SETTINGS)).not.toContain('justify');
  });
  test('justified is stored, keyed and passed to the layout', () => {
    const settings = normalizeReadingSettings({ textAlign: 'justify' });
    expect(settings.textAlign).toBe('justify');
    expect(readingTextStyle(settings).textAlign).toBe('justify');
    expect(readingSettingsKey(settings)).toContain('justify');
  });
  test('unknown values fall back to left', () => {
    expect(normalizeReadingSettings({ textAlign: 'center' }).textAlign).toBe('left');
  });
});
