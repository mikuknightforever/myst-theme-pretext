import { describe, expect, test } from 'vitest';
import { contentScrollTop, contentTopInScroll, scrollTopForContentY } from './scroll-geometry.js';

// A scroll container at viewport y=68, scrolled by 300, whose content starts
// 450px below the top of its scrollable area (under a header).
const scroll = { scrollTop: 300, getBoundingClientRect: () => ({ top: 68 }) as DOMRect };
const content = { getBoundingClientRect: () => ({ top: 68 + 450 - 300 }) as DOMRect };

describe('content coordinates inside a scroll container with a header', () => {
  test('finds where the content starts in scroll coordinates', () => {
    expect(contentTopInScroll(scroll, content)).toBe(450);
  });
  test('converts the scroll position to layout coordinates', () => {
    expect(contentScrollTop(scroll, content)).toBe(-150);
  });
  test('converts a layout position back to a scroll position', () => {
    expect(scrollTopForContentY(scroll, content, 1000)).toBe(1450);
    expect(scrollTopForContentY(scroll, content, -1000)).toBe(0);
  });
  test('without a content element, coordinates are unchanged', () => {
    expect(contentScrollTop(scroll, null)).toBe(300);
    expect(scrollTopForContentY(scroll, undefined, 40)).toBe(40);
  });
});
