// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, it, expect } from 'vitest';
import type { IOutput } from '@jupyterlab/nbformat';
import { generatedIds, outputWithUniqueIds, withUniqueIds } from './unique-ids.js';

// The shape of a Plotly HTML export, with an embedded library that also has
// short ids which must not change.
const PLOTLY = `<div><script>var a={id:"number"};</script><svg id="Layer_1"></svg>
<div id="bb9680f7-a718-49cb-84a8-3f698d94d2f3" class="plotly-graph-div"></div>
<script>if (document.getElementById("bb9680f7-a718-49cb-84a8-3f698d94d2f3")) {
Plotly.newPlot('bb9680f7-a718-49cb-84a8-3f698d94d2f3', [], {}); }</script>
<input id="number"></div>`;

// An Altair chart from a different field, with its own generated id.
const ALTAIR = `<div id="altair-viz-3f2a9c1e7b6d4e0f8a1b2c3d4e5f6a7b"></div>
<script>vegaEmbed("#altair-viz-3f2a9c1e7b6d4e0f8a1b2c3d4e5f6a7b", spec);</script>`;

describe('generatedIds', () => {
  it('finds generated ids and skips ordinary words', () => {
    expect(generatedIds(PLOTLY)).toEqual(['bb9680f7-a718-49cb-84a8-3f698d94d2f3']);
    expect(generatedIds(ALTAIR)).toEqual(['altair-viz-3f2a9c1e7b6d4e0f8a1b2c3d4e5f6a7b']);
  });

  it('skips long ids without a digit', () => {
    expect(generatedIds('<div id="a-very-long-plain-name"></div>')).toEqual([]);
  });
});

describe('withUniqueIds', () => {
  it('rewrites the id and every mention of it', () => {
    const html = withUniqueIds(PLOTLY, 'r1');
    expect(html.split('bb9680f7-a718-49cb-84a8-3f698d94d2f3-r1')).toHaveLength(4);
    expect(html).not.toMatch(/f3["']/);
  });

  it('leaves ordinary ids alone', () => {
    const html = withUniqueIds(PLOTLY, 'r1');
    expect(html).toContain('id="number"');
    expect(html).toContain('{id:"number"}');
    expect(html).toContain('id="Layer_1"');
  });

  it('gives two copies different ids', () => {
    expect(withUniqueIds(ALTAIR, 'a')).not.toEqual(withUniqueIds(ALTAIR, 'b'));
  });
});

describe('outputWithUniqueIds', () => {
  it('rewrites text/html given as a string or a list of lines', () => {
    const asString = { output_type: 'display_data', data: { 'text/html': ALTAIR }, metadata: {} } as IOutput;
    const asLines = { output_type: 'display_data', data: { 'text/html': ALTAIR.split('\n') }, metadata: {} } as IOutput;
    expect(JSON.stringify(outputWithUniqueIds(asString, 'x'))).toContain('a7b-x');
    expect(JSON.stringify(outputWithUniqueIds(asLines, 'x'))).toContain('a7b-x');
  });

  it('returns an output without HTML unchanged', () => {
    const output = { output_type: 'stream', name: 'stdout', text: 'id="0123456789abcdef0"' } as IOutput;
    expect(outputWithUniqueIds(output, 'x')).toBe(output);
  });
});
