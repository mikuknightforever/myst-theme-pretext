import { describe, expect, test } from 'vitest';
import { CAPTION_TOGGLE_H, resizedCardLayout } from './figure-layout.js';

describe('resized figure cards', () => {
  test('height follows width: the figure fills the width, the caption sits right under it', () => {
    const card = resizedCardLayout(400, 0.5, 60, false);
    expect(card).toEqual({ figureHeight: 200, height: 260, mode: 'inline' });
  });

  test('a caption taller than most of the figure collapses into a toggle under it', () => {
    // A tall, narrow card: the figure is 264px high, its caption would be 250px.
    const card = resizedCardLayout(240, 1.1, 250, false);
    expect(card.mode).toBe('collapsed');
    expect(card.figureHeight).toBe(264);
    expect(card.height).toBe(264 + CAPTION_TOGGLE_H);
  });

  test('opening a collapsed caption keeps the width and adds the caption below', () => {
    const card = resizedCardLayout(240, 1.1, 250, true);
    expect(card).toEqual({ figureHeight: 264, height: 264 + 250, mode: 'expanded' });
  });

  test('a figure without a caption is just the figure', () => {
    expect(resizedCardLayout(300, 0.6, 0, false)).toEqual({
      figureHeight: 180,
      height: 180,
      mode: 'inline',
    });
  });
});
