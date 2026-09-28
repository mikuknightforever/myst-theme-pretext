import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';
import { collectArticle, withFrontmatterAbstract } from './content/article.js';

vi.mock('@myst-theme/providers', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReferences: () => ({ article: { type: 'root', children: [] } }),
  useThemeSwitcher: () => ({ isDark: false }),
  useSiteManifest: () => ({}),
  useFrontmatter: () => ({}),
}));

import { PretextArticle, usePretextHeader } from './renderers.js';

const text = (value: string) => ({ type: 'text', value });
const heading = (title: string, enumerator?: string) => ({
  type: 'heading',
  depth: 2,
  enumerator,
  children: [text(title)],
});
const paragraph = (value: string) => ({ type: 'paragraph', children: [text(value)] });
const headings = (root: any) =>
  collectArticle(root).blocks.flatMap((block) =>
    block.type === 'heading'
      ? [{ title: block.headingTitle, words: block.words.map((w) => w.text) }]
      : [],
  );

describe('article front matter in Pretext', () => {
  test('the abstract heading is shown without its section number', () => {
    const root = {
      type: 'root',
      children: [heading('Abstract', '1'), paragraph('Summary'), heading('Introduction', '2')],
    };
    expect(headings(root)).toEqual([
      { title: 'Abstract', words: ['Abstract'] },
      { title: '2 Introduction', words: ['2', 'Introduction'] },
    ]);
  });

  test('a front-matter-only abstract is placed first in the flow, once', () => {
    const body = { type: 'root', children: [heading('Introduction', '1'), paragraph('Body')] };
    const frontmatter = {
      parts: { abstract: { mdast: { type: 'root', children: [paragraph('From front matter')] } } },
    };
    const snapshot = JSON.stringify(body);
    const merged = withFrontmatterAbstract(body, frontmatter);
    expect(headings(merged).map((h) => h.title)).toEqual(['Abstract', '1 Introduction']);
    const paragraphs = collectArticle(merged).blocks.filter((b) => b.type === 'paragraph');
    expect(paragraphs[0].type === 'paragraph' && paragraphs[0].words.map((w) => w.text)).toEqual([
      'From',
      'front',
      'matter',
    ]);
    expect(JSON.stringify(body)).toBe(snapshot);
  });

  test('no abstract is added when the body already has one or none exists', () => {
    const withBodyAbstract = {
      type: 'root',
      children: [heading('Abstract', '1'), paragraph('Body abstract')],
    };
    const frontmatter = { parts: { abstract: { mdast: { type: 'root', children: [] } } } };
    expect(withFrontmatterAbstract(withBodyAbstract, frontmatter)).toBe(withBodyAbstract);
    const plain = { type: 'root', children: [paragraph('Body')] };
    expect(withFrontmatterAbstract(plain, {})).toBe(plain);
    expect(withFrontmatterAbstract(plain, undefined)).toBe(plain);
  });

  test('a header passed by the theme is available to the Pretext session', () => {
    function Probe() {
      return <>{usePretextHeader()}</>;
    }
    const html = renderToStaticMarkup(
      <PretextArticle articleId="a" header={<h1>Paper title card</h1>}>
        <Probe />
      </PretextArticle>,
    );
    expect(html).toContain('<h1>Paper title card</h1>');
  });
});
