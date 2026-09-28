/* eslint-disable import/no-extraneous-dependencies */
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { extractWords } from './content/inline.js';
import { DEFAULT_TEXT_STYLE, layoutBlocks, type WordSpan } from './layout.js';

const text = (value: string) => ({ type: 'text', value });
const cite = {
  type: 'cite',
  label: 'nyatega_2022',
  identifier: 'nyatega_2022',
  key: 'c1',
  children: [text('Nyatega '), { type: 'emphasis', children: [text('et al.')] }, text(', 2022')],
};
const link = {
  type: 'link',
  url: 'https://sct.example',
  key: 'l1',
  children: [text('Spinal Cord Toolbox (SCT)')],
};

describe('citations and links can break across lines', () => {
  test('a multi-word link becomes one piece per word, each the same link', () => {
    const words = extractWords(link);
    expect(words.map((w) => w.text)).toEqual(['Spinal', 'Cord', 'Toolbox', '(SCT)']);
    for (const word of words) {
      expect(word.semanticNode.type).toBe('link');
      expect(word.semanticNode.url).toBe('https://sct.example');
      expect(word.semanticNode.children).toEqual([text(word.text)]);
    }
    expect(new Set(words.map((w) => w.semanticNode.key)).size).toBe(words.length);
  });

  test('citation pieces keep their label and the italic "et al."', () => {
    const words = extractWords(cite);
    expect(words.map((w) => w.text)).toEqual(['Nyatega', 'et', 'al.', ',', '2022']);
    expect(words.every((w) => w.semanticNode.label === 'nyatega_2022')).toBe(true);
    expect(words[1].semanticNode.children[0].type).toBe('emphasis');
    // "al." and "," stay attached, so the line cannot break between them.
    expect(words[2].spaceAfter).toBeFalsy();
    expect(words[3].spaceBefore).toBeFalsy();
  });

  test('a single-word link stays one token, as before', () => {
    const words = extractWords({ type: 'link', url: 'x', children: [text('DIPY')] });
    expect(words).toHaveLength(1);
    expect(words[0].semanticNode.children).toEqual([text('DIPY')]);
  });
});

describe('justifying lines next to citations', () => {
  beforeAll(() => {
    const context = { font: '', measureText: (t: string) => ({ width: t.length * 8 }) };
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context }) });
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test('a line before a long citation is justified instead of left ragged', () => {
    const longCite = {
      type: 'cite',
      label: 'ucl',
      key: 'c2',
      children: [text('UCL Microstructure Imaging Group, 2021')],
    };
    const words = extractWords({
      type: 'paragraph',
      children: [
        text('computed using the NODDI toolbox by '),
        longCite,
        text(' and then more words follow here.'),
      ],
    });
    const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 20, textAlign: 'justify' as const };
    const spans = layoutBlocks([{ type: 'paragraph', words }], [], 260, 0, style).spans;
    const lines = new Map<number, WordSpan[]>();
    for (const span of spans) lines.set(span.y, [...(lines.get(span.y) ?? []), span]);
    const all = [...lines.values()];
    for (const line of all.slice(0, -1)) {
      const last = line[line.length - 1];
      expect(last.x + last.text.length * 8).toBeCloseTo(260, 0);
    }
  });
});
