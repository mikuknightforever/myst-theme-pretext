import { describe, expect, test } from 'vitest';
import { collectArticle, collectBlocks } from './layout.js';
import {
  figureLabel,
  figureParts,
  isStaticFigure,
  simpleIframe,
  unsupportedTypes,
  nativeBlockNode,
} from './content-detection.js';

const text = (value: string) => ({ type: 'text', value });
const paragraph = (...children: any[]) => ({ type: 'paragraph', children });
const image = (name: string) => ({ type: 'image', url: `/images/${name}.svg`, alt: name });
const caption = (number: string) => ({
  type: 'caption',
  children: [
    paragraph(
      { type: 'captionNumber', enumerator: number, children: [text(`Figure ${number}:`)] },
      text('Original caption'),
    ),
  ],
});
const figure = (name: string, number = '7') => ({
  type: 'container',
  kind: 'figure',
  identifier: name,
  children: [image(name), caption(number)],
});
const article = (...children: any[]) => ({ type: 'root', children });
function deepFreeze(value: any): any {
  Object.freeze(value);
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object') deepFreeze(child);
  });
  return value;
}
function richNodes(result: ReturnType<typeof collectArticle>) {
  return result.blocks.flatMap((block) => (block.type === 'richBlock' ? [block.node] : []));
}

describe('automatic article content detection', () => {
  test('recognizes unmarked figures without changing the source tree or caption numbering', () => {
    const fig = figure('unmarked', 'A.2');
    const source = deepFreeze(article(paragraph(text('Before')), fig, paragraph(text('After'))));
    const snapshot = JSON.stringify(source);
    const result = collectArticle(source);
    expect(result.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'figureAnchor',
      'paragraph',
    ]);
    expect(result.figures).toHaveLength(1);
    expect(result.figures[0]).toMatchObject({
      label: 'Figure A.2',
      imageUrl: '/images/unmarked.svg',
    });
    expect(result.figures[0].mdastNode).toBe(fig);
    expect(JSON.stringify(source)).toBe(snapshot);
    expect(collectBlocks(source)).toEqual(result.blocks);
  });

  test('one traversal keeps marked, unmarked, bare and image-only paragraphs in the same order', () => {
    const sources = [
      figure('a'),
      { ...figure('b'), class: 'pretext-draggable' },
      image('c'),
      paragraph(image('d')),
      { type: 'container', class: 'custom-drag', children: [image('e')] },
    ];
    const result = collectArticle(article(...sources), { draggableSelector: '.custom-drag' });
    expect(result.figures.map((fig) => fig.mdastNode)).toEqual(sources);
    expect(result.blocks).toEqual(
      sources.map((_, figureIndex) => ({ type: 'figureAnchor', figureIndex })),
    );
    expect(result.figures[2].label).toBe('Image');
  });

  test('legacy custom classes still work, without replacing ordinary automatic detection', () => {
    const old = { type: 'container', className: 'wide custom-drag', children: [image('old')] };
    expect(
      collectArticle(article(old, figure('new')), { draggableSelector: 'custom-drag' }).figures,
    ).toHaveLength(2);
  });

  test.each([
    paragraph(text('Before '), image('inline'), text(' after')),
    paragraph({ type: 'link', url: 'https://example.org', children: [image('linked')] }),
    paragraph(text('Hard'), { type: 'break' }, text('break')),
    { type: 'heading', depth: 2, children: [text('Title'), image('icon')] },
  ])('keeps complex inline content intact in the native renderer: %#', (node) => {
    const result = collectArticle(article(node));
    expect(result.figures).toHaveLength(0);
    expect(richNodes(result)).toEqual([node]);
  });

  test.each([
    {
      type: 'container',
      kind: 'table',
      class: 'pretext-draggable',
      children: [{ type: 'table', children: [image('cell')] }, caption('3')],
    },
    {
      type: 'container',
      kind: 'figure',
      class: 'pretext-draggable',
      children: [{ type: 'iframe', src: '/demo' }, caption('5')],
    },
    {
      type: 'container',
      kind: 'figure',
      children: [{ type: 'widget', children: [image('preview')] }, caption('6')],
    },
    { type: 'container', kind: 'figure', children: [image('left'), image('right'), caption('8')] },
    {
      type: 'container',
      kind: 'figure',
      children: [image('one'), { type: 'caption', children: [{ type: 'custom-control' }] }],
    },
  ])('keeps compound or interactive figures as one native block: %#', (node) => {
    const result = collectArticle(article(node));
    expect(result.figures).toHaveLength(0);
    expect(richNodes(result)).toEqual([node]);
  });

  test('preserves legends as well as images and captions, without duplicate image extraction', () => {
    const img = image('legend');
    const cap = caption('12');
    const legend = { type: 'legend', children: [paragraph(text('Additional legend'))] };
    const node = { type: 'container', kind: 'figure', children: [img, cap, legend] };
    expect(figureParts(node)).toEqual({ body: [img], captions: [cap, legend] });
    expect(collectArticle(article(node)).figures).toHaveLength(1);
  });

  test('uses resolved localized caption labels and does not renumber unnumbered images', () => {
    expect(
      figureLabel({
        ...figure('a'),
        children: [
          image('a'),
          {
            type: 'caption',
            children: [{ type: 'captionNumber', enumerator: '九', children: [text('图 九：')] }],
          },
        ],
      }),
    ).toBe('图 九');
    expect(figureLabel(image('b'))).toBe('Image');
    expect(figureLabel({ type: 'container', kind: 'figure', children: [image('c')] })).toBe(
      'Figure',
    );
  });

  test('retains ordered/nested/task/multi-paragraph lists and images in lists', () => {
    const item = (children: any[]) => ({ type: 'listItem', children });
    const lists = [
      { type: 'list', ordered: true, start: 4, children: [item([paragraph(text('Fourth'))])] },
      {
        type: 'list',
        children: [
          item([
            paragraph(text('Outer')),
            { type: 'list', children: [item([paragraph(text('Inner'))])] },
          ]),
        ],
      },
      { type: 'list', children: [{ ...item([paragraph(text('Task'))]), checked: true }] },
      { type: 'list', children: [item([paragraph(text('First')), paragraph(text('Second'))])] },
      { type: 'list', children: [item([paragraph(image('inside'))])] },
    ];
    const result = collectArticle(article(...lists));
    expect(richNodes(result)).toEqual(lists);
    expect(result.figures).toHaveLength(0);
  });

  test('keeps simple bullets on the existing text reflow path', () => {
    const result = collectArticle(
      article({
        type: 'list',
        children: [{ type: 'listItem', children: [paragraph(text('Simple bullet'))] }],
      }),
    );
    expect(result.blocks[0]).toMatchObject({ type: 'listItem', bullet: true });
  });

  test('preserves superscripts as measured semantic tokens without making the whole paragraph indivisible', () => {
    const superscript = { type: 'superscript', children: [text('2')] };
    const result = collectArticle(article(paragraph(text('x'), superscript)));
    expect(result.blocks[0]).toMatchObject({
      type: 'paragraph',
      words: [{ text: 'x' }, { text: '2', semanticNode: superscript }],
    });
  });

  test('keeps math, tables, code, footnotes and extension nodes, skipping only non-rendered metadata', () => {
    const nodes = [
      { type: 'math', value: 'x^2', enumerator: '10' },
      { type: 'table', children: [] },
      { type: 'code', value: 'print(1)' },
      { type: 'footnoteDefinition', identifier: 'note', children: [paragraph(text('Note'))] },
      { type: 'custom-output', value: 'Do not lose this' },
      { type: 'mystDirective', name: 'missing', value: 'Keep source' },
    ];
    const result = collectArticle(
      article({ type: 'pretext-widget' }, ...nodes, { type: 'comment', value: 'Hidden' }),
    );
    expect(richNodes(result)).toEqual(nodes);
    expect(result.blocks.map((block: any) => block.richBlockIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('iframe shortcut is restricted to one frame plus captions, preserving other siblings', () => {
    const iframe = { type: 'iframe', src: '/interactive', height: 400 };
    expect(simpleIframe(iframe)).toBe(iframe);
    expect(simpleIframe({ type: 'container', children: [iframe, caption('5')] })).toBe(iframe);
    expect(
      simpleIframe({ type: 'container', children: [iframe, image('also-visible'), caption('5')] }),
    ).toBeUndefined();
    expect(simpleIframe({ type: 'container', children: [iframe, iframe] })).toBeUndefined();
  });

  test('unsupported native node types can be reported instead of disappearing silently', () => {
    expect(
      unsupportedTypes(paragraph(text('Supported'), { type: 'unknown-leaf' }), {
        paragraph: {},
        text: {},
      }),
    ).toEqual(['unknown-leaf']);
  });

  test('footnote bodies get a visible native wrapper because the standard definition renderer is hidden', () => {
    const source = deepFreeze({
      type: 'footnoteDefinition',
      identifier: 'note',
      enumerator: '3',
      children: [paragraph(text('Footnote body'))],
    });
    const result = nativeBlockNode(source);
    expect(result).toMatchObject({ type: 'div', html_id: 'fn-note' });
    expect(result.children[1]).toBe(source.children[0]);
    expect(source.type).toBe('footnoteDefinition');
    expect(nativeBlockNode(source.children[0])).toBe(source.children[0]);
  });

  test('does not mistake whitespace, text-only paragraphs or empty markers for figures', () => {
    expect(isStaticFigure(paragraph(text('Ordinary text')))).toBe(false);
    expect(isStaticFigure({ type: 'container', class: 'pretext-draggable', children: [] })).toBe(
      false,
    );
    expect(isStaticFigure(paragraph(text('  '), image('solo'), text('\n')))).toBe(true);
  });
});
