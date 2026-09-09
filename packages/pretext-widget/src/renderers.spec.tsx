import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  site: {} as any,
  frontmatter: {} as any,
  article: undefined as any,
  collect: vi.fn(() => ({ blocks: [{}], figures: [] })),
}));
vi.mock('@myst-theme/providers', () => ({
  useReferences: () => ({ article: fixture.article }),
  useThemeSwitcher: () => ({ isDark: false }),
  useSiteManifest: () => fixture.site,
  useFrontmatter: () => fixture.frontmatter,
}));
vi.mock('./layout.js', () => ({ collectArticle: fixture.collect }));
vi.mock('./components/PretextOverlay.js', () => ({ PretextOverlay: () => null }));
vi.mock('./components/PretextLauncher.js', () => ({
  PretextLauncher: () => <button>Open Pretext Mode</button>,
}));

import { PretextArticle, PretextWidgetRenderer } from './renderers.js';

const legacy = { type: 'pretext-widget' as const, draggableSelector: 'custom-image' };
const markup = (legacyCount = 0) =>
  renderToStaticMarkup(
    <PretextArticle articleId="test-article">
      <p>Original article content</p>
      {Array.from({ length: legacyCount }, (_, index) => (
        <PretextWidgetRenderer key={index} node={legacy} />
      ))}
    </PretextArticle>,
  );
const launcherCount = (html: string) => (html.match(/Open Pretext Mode/g) ?? []).length;

beforeEach(() => {
  fixture.site = {};
  fixture.frontmatter = {};
  fixture.article = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: 'Article' }] }],
  };
  fixture.collect.mockReset().mockReturnValue({ blocks: [{}], figures: [] });
});

describe('article-scoped Pretext entry', () => {
  it('renders one automatic entry without any article directive or AST mutation', () => {
    fixture.site = { options: { pretext: true } };
    const original = JSON.stringify(fixture.article);
    const html = markup();
    expect(launcherCount(html)).toBe(1);
    expect(html).toContain('Original article content');
    expect(JSON.stringify(fixture.article)).toBe(original);
  });

  it('deduplicates automatic and legacy entries, preserving the legacy selector', () => {
    fixture.site = { options: { pretext: true } };
    fixture.article.children.unshift(legacy);
    expect(launcherCount(markup(2))).toBe(1);
    expect(fixture.collect).toHaveBeenCalledWith(fixture.article, {
      draggableSelector: 'custom-image',
    });
  });

  it('keeps the old directive entry when configuration is omitted', () => {
    expect(launcherCount(markup(1))).toBe(1);
    expect(launcherCount(markup())).toBe(0);
  });

  it.each(['site', 'page'])('explicit %s false disables automatic and manual entries', (level) => {
    fixture.site = { options: { pretext: level === 'page' } };
    if (level === 'page') fixture.frontmatter = { site: { pretext: false } };
    expect(launcherCount(markup(1))).toBe(0);
    expect(fixture.collect).not.toHaveBeenCalled();
  });

  it('allows a page opt-in on a site where Pretext is disabled', () => {
    fixture.site = { options: { pretext: false } };
    fixture.frontmatter = { site: { pretext: true } };
    expect(launcherCount(markup())).toBe(1);
  });

  it('does not offer an empty or missing article', () => {
    fixture.site = { options: { pretext: true } };
    fixture.article = undefined;
    expect(launcherCount(markup())).toBe(0);
    fixture.article = { type: 'root', children: [] };
    fixture.collect.mockReturnValue({ blocks: [], figures: [] });
    expect(launcherCount(markup())).toBe(0);
  });

  it('supports the renderer in themes without the automatic-entry integration', () => {
    expect(launcherCount(renderToStaticMarkup(<PretextWidgetRenderer node={legacy} />))).toBe(1);
  });
});
