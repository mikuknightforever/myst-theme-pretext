import { describe, expect, test } from 'vitest';
import { captionMode } from './figure-layout.js';

const card = (height: number, inline = false) => ({ x: 0, y: 0, width: 300, height, inline });

describe('collapsing captions on small figure cards', () => {
  test('cards in their article place always show the caption', () => {
    expect(captionMode(card(120, true), 80, false)).toBe('inline');
  });
  test('a resized card with enough room keeps its caption inside', () => {
    expect(captionMode(card(400), 60, false)).toBe('inline');
  });
  test('a small card collapses the caption so the figure keeps its space', () => {
    expect(captionMode(card(140), 90, false)).toBe('collapsed');
    // Under 60px for the figure also collapses, even at a small share.
    expect(captionMode(card(100), 45, false)).toBe('collapsed');
  });
  test('an opened caption is shown below the figure, adding height instead', () => {
    expect(captionMode(card(140), 90, true)).toBe('expanded');
  });
  test('a figure without a caption has nothing to collapse', () => {
    expect(captionMode(card(80), 0, false)).toBe('inline');
  });
});
