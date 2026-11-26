import { describe, expect, test } from 'vitest';
import { mergeRenderers } from '@myst-theme/providers';
import { selectRenderer } from 'myst-to-react';
import { collectArticle } from './layout.js';
import {
  focusedRegions,
  isRegionAnnotation,
  parseRegionAnnotation,
  regionAt,
  sectionChain,
} from './figure-regions.js';
import { activeHeadingAt } from './hooks/useActiveHeading.js';
import { cropDisplaySize } from './figures/RegionZoom.js';
import { PRETEXT_RENDERERS } from './index.js';
import type { HeadingAnchor } from './layout/types.js';

const text = (value: string) => ({ type: 'text', value });
const paragraph = (value: string) => ({ type: 'paragraph', children: [text(value)] });
const heading = (title: string, extra: Record<string, unknown> = {}, depth = 3) => ({
  type: 'heading',
  depth,
  children: [text(title)],
  ...extra,
});
const figure = (label: string, url = '/quack.png') => ({
  type: 'container',
  kind: 'figure',
  label,
  identifier: label,
  html_id: label.replace(/:/g, '-'),
  children: [
    { type: 'image', url },
    { type: 'caption', children: [paragraph('Caption')] },
  ],
});
const annotation = (value: string, options: Record<string, unknown> = { lang: 'yaml' }) => ({
  type: 'code',
  class: 'pretext-regions',
  value,
  ...options,
});

const QUACK = `
figure: fig:overall
regions:
  - id: map
    label: Map & state space
    box: [0.00, 0.00, 0.64, 1.00]
    sections: [ssec:env-state]
  - id: actions
    label: Available actions
    box: [0.66, 0.87, 0.98, 0.97]
    sections: ssec:env-action
  - id: views
    label: Local views
    box: [0.68, 0.01, 0.97, 0.46]
    sections: [Observation Space, ssec:env-agent]
`;

describe('region annotations', () => {
  test('are recognised by class or by code language, nothing else', () => {
    expect(isRegionAnnotation(annotation('x'))).toBe(true);
    expect(isRegionAnnotation({ type: 'code', lang: 'pretext-regions', value: '' })).toBe(true);
    expect(isRegionAnnotation({ type: 'code', class: 'note pretext-regions' })).toBe(true);
    expect(isRegionAnnotation({ type: 'code', lang: 'yaml', value: 'regions: []' })).toBe(false);
    expect(isRegionAnnotation({ type: 'paragraph', class: 'pretext-regions' })).toBe(false);
  });

  test('parse YAML (and JSON) into validated regions', () => {
    const parsed = parseRegionAnnotation(QUACK)!;
    expect(parsed.figure).toBe('fig:overall');
    expect(parsed.regions.map((region) => region.id)).toEqual(['map', 'actions', 'views']);
    expect(parsed.regions[1].sections).toEqual(['ssec:env-action']);
    expect(parsed.regions[0].box).toEqual([0, 0, 0.64, 1]);
    expect(parseRegionAnnotation('{"regions":[{"box":[0,0,0.5,0.5]}]}')!.regions[0]).toMatchObject({
      id: 'region-1',
      label: 'region-1',
      sections: [],
    });
  });

  test('broken annotations switch the feature off instead of failing', () => {
    expect(parseRegionAnnotation('regions: [')).toBeNull();
    expect(parseRegionAnnotation('just text')).toBeNull();
    expect(parseRegionAnnotation('regions: {}')).toBeNull();
    const partial = parseRegionAnnotation(`
regions:
  - id: ok
    box: [0, 0, 1, 1]
  - id: outside
    box: [0, 0, 1.5, 1]
  - id: inverted
    box: [0.5, 0, 0.2, 1]
  - id: short
    box: [0, 0, 1]
  - not a region
`)!;
    expect(partial.regions.map((region) => region.id)).toEqual(['ok']);
  });

  test('attach to the labelled figure and resolve section labels and titles', () => {
    const mdast = {
      type: 'root',
      children: [
        figure('fig:overall'),
        annotation(QUACK),
        heading('Observation Space', { label: 'ssec:env-obs', identifier: 'ssec:env-obs' }),
        paragraph('Observation text.'),
        heading('Agents', { label: 'ssec:env-agent', html_id: 'ssec-env-agent' }),
        heading('Map and State Space', { label: 'ssec:env-state', html_id: 'ssec-env-state' }),
        heading('Action Space', { label: 'ssec:env-action', html_id: 'ssec-env-action' }),
      ],
    };
    const { blocks, figures } = collectArticle(mdast);
    // The annotation is metadata: it never enters the reading flow.
    expect(blocks.some((block) => block.type === 'richBlock')).toBe(false);
    const regions = figures[0].regions!;
    expect(regions.find((region) => region.id === 'map')!.sectionIds).toEqual(['ssec-env-state']);
    expect(regions.find((region) => region.id === 'actions')!.sectionIds).toEqual([
      'ssec-env-action',
    ]);
    expect(regions.find((region) => region.id === 'views')!.sectionIds).toEqual([
      'ssec:env-obs',
      'ssec-env-agent',
    ]);
  });

  test('without a figure label they belong to the nearest preceding figure', () => {
    const mdast = {
      type: 'root',
      children: [
        figure('fig:a', '/a.png'),
        figure('fig:b', '/b.png'),
        annotation('regions:\n  - box: [0, 0, 1, 1]'),
      ],
    };
    const { figures } = collectArticle(mdast);
    expect(figures[0].regions).toBeUndefined();
    expect(figures[1].regions).toHaveLength(1);
  });

  test('an unknown figure label leaves every figure unannotated', () => {
    const mdast = {
      type: 'root',
      children: [figure('fig:a'), annotation('figure: fig:zzz\nregions:\n  - box: [0, 0, 1, 1]')],
    };
    expect(collectArticle(mdast).figures[0].regions).toBeUndefined();
  });

  test('are hidden from the article view while ordinary code keeps its renderer', () => {
    const BaseCode = () => null;
    const renderers = mergeRenderers([{ code: BaseCode }, PRETEXT_RENDERERS], true);
    expect(selectRenderer(renderers, annotation('x'))).not.toBe(BaseCode);
    expect(selectRenderer(renderers, { type: 'code', lang: 'pretext-regions' } as any)).not.toBe(
      BaseCode,
    );
    expect(selectRenderer(renderers, { type: 'code', lang: 'python' } as any)).toBe(BaseCode);
    expect(selectRenderer(renderers, { type: 'code', class: 'regions-other' } as any)).toBe(
      BaseCode,
    );
  });
});

describe('section-aware focus', () => {
  const headings: HeadingAnchor[] = [
    { id: 'env', title: '3 The QUACK Environment', depth: 2, y: 0 },
    { id: 'obs', title: '3.3 Observation Space', depth: 3, y: 400 },
    { id: 'action', title: '3.5 Action Space', depth: 3, y: 900 },
    { id: 'eval', title: '4 Evaluation', depth: 2, y: 1400 },
  ];
  const regions = parseRegionAnnotation(QUACK)!.regions.map((region) => ({
    ...region,
    sectionIds: region.id === 'map' ? ['env'] : region.id === 'views' ? ['obs'] : ['action'],
  }));

  test('the reading marker selects the last heading above it', () => {
    expect(activeHeadingAt(headings, -10)).toBeNull();
    expect(activeHeadingAt(headings, 450)).toBe('obs');
    expect(activeHeadingAt(headings, 1399)).toBe('action');
  });

  test('the most specific linked section wins; containing sections are a fallback', () => {
    expect(sectionChain(headings, 'obs').map((h) => h.id)).toEqual(['obs', 'env']);
    expect([...focusedRegions(regions, sectionChain(headings, 'obs'))!.regionIds]).toEqual([
      'views',
    ]);
    expect([...focusedRegions(regions, sectionChain(headings, 'env'))!.regionIds]).toEqual(['map']);
    expect(focusedRegions(regions, sectionChain(headings, 'eval'))).toBeNull();
    expect(focusedRegions(undefined, sectionChain(headings, 'obs'))).toBeNull();
    expect(focusedRegions(regions, [])).toBeNull();
  });

  test('clicks hit the smallest region under the pointer', () => {
    const all = parseRegionAnnotation(`
regions:
  - id: summary
    box: [0.6, 0.5, 1, 1]
  - id: actions
    box: [0.66, 0.87, 0.98, 0.97]
`)!.regions;
    expect(regionAt(all, 0.7, 0.9)!.id).toBe('actions');
    expect(regionAt(all, 0.7, 0.6)!.id).toBe('summary');
    expect(regionAt(all, 0.1, 0.1)).toBeNull();
  });

  test('zoomed crops keep the region shape, with a small margin, without blurring', () => {
    const region = parseRegionAnnotation('regions:\n  - box: [0.5, 0.5, 1, 1]')!.regions[0];
    const crop = cropDisplaySize(
      region,
      { width: 2000, height: 1000 },
      { width: 1200, height: 600 },
    );
    expect(crop.box).toEqual([0.485, 0.485, 1, 1]);
    expect(crop.width / crop.height).toBeCloseTo((0.515 * 2000) / (0.515 * 1000), 2);
    expect(crop.height).toBeLessThanOrEqual(600);
    const tiny = cropDisplaySize(region, { width: 100, height: 100 }, { width: 1200, height: 600 });
    expect(tiny.width).toBeLessThanOrEqual(Math.ceil(0.515 * 100 * 2));
  });
});
