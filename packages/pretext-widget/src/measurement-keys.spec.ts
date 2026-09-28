import { describe, expect, test } from 'vitest';
import { DEFAULT_TEXT_STYLE, inlineMeasurementKey } from './layout.js';

const token = { text: 'Smith et al., 2020', bold: false, italic: false, code: false };

describe('DOM token measurement keys', () => {
  test('line height and paragraph spacing do not re-measure citations, links or math', () => {
    const base = inlineMeasurementKey(token, DEFAULT_TEXT_STYLE);
    expect(inlineMeasurementKey(token, { ...DEFAULT_TEXT_STYLE, lineHeight: 40 })).toBe(base);
    expect(inlineMeasurementKey(token, { ...DEFAULT_TEXT_STYLE, paragraphGap: 30 })).toBe(base);
    expect(inlineMeasurementKey(token, { ...DEFAULT_TEXT_STYLE, textAlign: 'justify' })).toBe(base);
  });
  test('font size still gets its own measurement', () => {
    expect(inlineMeasurementKey(token, { ...DEFAULT_TEXT_STYLE, fontSize: 20 })).not.toBe(
      inlineMeasurementKey(token, DEFAULT_TEXT_STYLE),
    );
  });
});
