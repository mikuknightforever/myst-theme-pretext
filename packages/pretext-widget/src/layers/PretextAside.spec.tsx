import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const theme = vi.hoisted(() => ({ isDark: false }));
vi.mock('@myst-theme/providers', () => ({
  useThemeSwitcher: () => theme,
  useNodeRenderers: () => ({}),
}));
// Render MyST nodes as their plain text, which is all these tests look at.
vi.mock('myst-to-react', () => {
  const textOf = (node: any): string =>
    node?.value ?? (node?.children ?? []).map(textOf).join('');
  return {
    MyST: ({ ast }: { ast: any[] }) => <>{ast.map((node, i) => <p key={i}>{textOf(node)}</p>)}</>,
  };
});

import { PretextAside } from './RichBlockLayer.js';

const aside = (...lines: string[]) => ({
  type: 'aside',
  children: lines.map((value) => ({ type: 'paragraph', children: [{ type: 'text', value }] })),
});

describe('PretextAside', () => {
  it('shows the note in the flow, without the margin layout of the theme aside', () => {
    const html = renderToStaticMarkup(<PretextAside node={aside('A field note', 'Second line')} />);
    expect(html).toContain('A field note');
    expect(html).toContain('Second line');
    expect(html).toContain('role="note"');
    expect(html).not.toContain('col-margin');
    expect(html).not.toContain('h-0');
  });

  it('uses a quieter colour in dark mode', () => {
    theme.isDark = true;
    const dark = renderToStaticMarkup(<PretextAside node={aside('Note')} />);
    theme.isDark = false;
    const light = renderToStaticMarkup(<PretextAside node={aside('Note')} />);
    expect(dark).not.toEqual(light);
  });
});
