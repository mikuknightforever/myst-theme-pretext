import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { collectArticle } from './layout.js';
import { isInteractiveOutputFigure, isStaticFigure } from './content-detection.js';
import { figureHeightForWidth, getFigureDisplaySize } from './figure-layout.js';
import { INTERACTIVE_FIGURE_HEADER_H } from './config.js';

vi.mock('myst-to-react', () => ({ MyST: () => <span>rendered output</span> }));

import { FigureCard } from './figures/FigureCard.js';

const text = (value: string) => ({ type: 'text', value });
const paragraph = (...children: any[]) => ({ type: 'paragraph', children });
const output = (id: string) => ({ type: 'output', id, data: [] });
const caption = (...extra: any[]) => ({
  type: 'caption',
  children: [
    paragraph(
      { type: 'captionNumber', enumerator: '4', children: [text('Figure 4:')] },
      text('ANOVA results'),
      ...extra,
    ),
  ],
});
const figure = (...body: any[]) => ({
  type: 'container',
  kind: 'figure',
  identifier: 'fig4',
  children: [...body, caption()],
});

describe('interactive notebook-output figures', () => {
  test('a figure whose body is one output becomes an interactive card', () => {
    const fig = figure(output('a'));
    expect(isInteractiveOutputFigure(fig)).toBe(true);
    expect(isStaticFigure(fig)).toBe(false);
    const result = collectArticle({ type: 'root', children: [paragraph(text('Before')), fig] });
    expect(result.blocks.map((block) => block.type)).toEqual(['paragraph', 'figureAnchor']);
    expect(result.figures).toHaveLength(1);
    expect(result.figures[0]).toMatchObject({
      label: 'Figure 4',
      interactive: true,
      imageUrl: null,
    });
  });

  test('accepts the newer outputs wrapper holding exactly one output', () => {
    expect(isInteractiveOutputFigure(figure({ type: 'outputs', children: [output('a')] }))).toBe(
      true,
    );
  });

  test('keeps compound, mixed, table and interactive-caption figures native', () => {
    const image = { type: 'image', url: '/x.png' };
    expect(isInteractiveOutputFigure(figure(output('a'), output('b')))).toBe(false);
    expect(
      isInteractiveOutputFigure(figure({ type: 'outputs', children: [output('a'), output('b')] })),
    ).toBe(false);
    expect(isInteractiveOutputFigure(figure(output('a'), image))).toBe(false);
    expect(isInteractiveOutputFigure({ ...figure(output('a')), kind: 'table' })).toBe(false);
    expect(
      isInteractiveOutputFigure({
        type: 'container',
        kind: 'figure',
        children: [output('a'), caption({ type: 'button', children: [] })],
      }),
    ).toBe(false);
    expect(isInteractiveOutputFigure(output('a'))).toBe(false);
    const result = collectArticle({ type: 'root', children: [figure(output('a'), output('b'))] });
    expect(result.figures).toHaveLength(0);
    expect(result.blocks.map((block) => block.type)).toEqual(['richBlock']);
  });

  test('static image figures are not marked interactive', () => {
    const result = collectArticle({
      type: 'root',
      children: [figure({ type: 'image', url: '/x.png' })],
    });
    expect(result.figures[0].interactive).toBeFalsy();
  });

  test('card height follows width through the measured output ratio plus the drag header', () => {
    const fig = {
      label: 'Figure 4',
      imageUrl: null,
      interactive: true,
      mdastNode: figure(output('a')),
    };
    const ratio = 360 / 760;
    const size = getFigureDisplaySize(fig, 480, ratio, 50);
    expect(size.width).toBe(480);
    expect(size.height).toBe(Math.round(480 * ratio) + INTERACTIVE_FIGURE_HEADER_H + 50);
    expect(figureHeightForWidth(fig, 240, ratio, 50)).toBe(
      Math.round(240 * ratio) + INTERACTIVE_FIGURE_HEADER_H + 50,
    );
  });

  test('only the header starts a drag; the output keeps pointer events', () => {
    const props = {
      pos: { x: 0, y: 0, width: 480, height: 300, inline: true },
      isDragging: false,
      isResizing: false,
      onPointerDown: () => {},
      onPointerMove: () => {},
      onPointerUp: () => {},
      onPointerCancel: () => {},
      onResizePointerDown: () => {},
      index: 0,
      isDark: false,
    };
    const interactive = renderToStaticMarkup(
      <FigureCard
        {...props}
        fig={{
          label: 'Figure 4',
          imageUrl: null,
          interactive: true,
          mdastNode: figure(output('a')),
        }}
      />,
    );
    expect(interactive).toContain('data-pretext-drag-handle');
    // Opts the body out of the image-fitting CSS so the output can be scaled.
    expect(interactive).toContain('data-pretext-interactive');
    expect(interactive).toMatch(/class="pretext-figure-body"[^>]*pointer-events:auto/);
    const staticCard = renderToStaticMarkup(
      <FigureCard
        {...props}
        fig={{
          label: 'Figure 1',
          imageUrl: '/x.png',
          mdastNode: figure({ type: 'image', url: '/x.png' }),
        }}
      />,
    );
    expect(staticCard).not.toContain('data-pretext-drag-handle');
    expect(staticCard).not.toContain('data-pretext-interactive');
    expect(staticCard).toMatch(/class="pretext-figure-body"[^>]*pointer-events:none/);
  });
});
