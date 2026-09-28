import { describe, expect, test } from 'vitest';
import { drawWords } from './draw-words.js';
import { DEFAULT_TEXT_STYLE, type WordSpan } from '../layout.js';

function recordingContext() {
  const calls: Array<{ text: string; transform: number[]; alpha: number }> = [];
  let transform = [1, 0, 0, 1, 0, 0];
  const ctx = {
    font: '',
    fillStyle: '',
    globalAlpha: 1,
    setTransform: (...m: number[]) => {
      transform = m;
    },
    measureText: (text: string) => ({ width: text.length * 8 }),
    fillText(text: string) {
      calls.push({ text, transform: [...transform], alpha: ctx.globalAlpha });
    },
  };
  return { ctx, calls };
}

const style = { ...DEFAULT_TEXT_STYLE, lineHeight: 24 };
const span = (text: string, x: number, y = 0): WordSpan => ({
  text,
  x,
  y,
  style,
  bold: false,
  italic: false,
  code: false,
});

describe('canvas word drawing', () => {
  test('words after a moved word are drawn without its transform', () => {
    const { ctx, calls } = recordingContext();
    const spans = [span('plain', 0), span('moved', 60), span('after', 120), span('last', 180)];
    drawWords(ctx as any, spans, {
      canvasTop: 0,
      yMin: -100,
      yMax: 100,
      dpr: 2,
      isDark: false,
      widthOf: (s) => s.text.length * 8,
      motionAt: (index) => (index === 1 ? { dx: 30, dy: -20, rotation: 0.5, scale: 1.2 } : null),
    });
    const byText = Object.fromEntries(calls.map((c) => [c.text, c]));
    expect(byText.moved.transform).not.toEqual([2, 0, 0, 2, 0, 0]);
    for (const text of ['plain', 'after', 'last']) {
      expect(byText[text].transform).toEqual([2, 0, 0, 2, 0, 0]);
      expect(byText[text].alpha).toBe(1);
    }
  });

  test('without any motion every word uses the plain transform', () => {
    const { ctx, calls } = recordingContext();
    drawWords(ctx as any, [span('a', 0), span('b', 20)], {
      canvasTop: 0,
      yMin: -100,
      yMax: 100,
      dpr: 1,
      isDark: false,
      widthOf: () => 8,
      motionAt: null,
    });
    expect(calls.map((c) => c.transform)).toEqual([
      [1, 0, 0, 1, 0, 0],
      [1, 0, 0, 1, 0, 0],
    ]);
  });
});
