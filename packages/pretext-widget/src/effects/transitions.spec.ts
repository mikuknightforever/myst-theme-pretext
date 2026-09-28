import { describe, expect, test } from 'vitest';
import { EffectsEngine, TRANSITION_MS, WAVE_MS } from './engine.js';

const span = (text: string, x: number, y: number) => ({ text, x, y });

describe('column switch transition', () => {
  test('words start where they were on screen and end in their new place', () => {
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startTransition([span('alpha', 10, 100), span('beta', 60, 100)], 1000);
    // New layout: 'beta' moved to a second column and the view scrolled by 50.
    engine.setView(50, 800);
    engine.beginFrame(1000);
    const start = engine.motion(1, 0, 0, span('beta', 400, 30))!;
    // On screen it was at (60, 100); now drawn at (400, 30 - 50 = -20).
    expect(start.dx).toBeCloseTo(60 - 400, 5);
    expect(start.dy).toBeCloseTo(100 + 50 - 30, 5);
    engine.beginFrame(1000 + TRANSITION_MS);
    expect(engine.motion(1, 0, 0, span('beta', 400, 30))).toBeNull();
  });

  test('a word whose text changed at that index is not animated', () => {
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startTransition([span('alpha', 10, 100)], 0);
    engine.beginFrame(10);
    expect(engine.motion(0, 0, 0, span('gamma', 300, 100))).toBeNull();
  });

  test('words coming from far off screen appear in place instead of streaking across', () => {
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startTransition([span('alpha', 10, 5000)], 0);
    engine.beginFrame(10);
    expect(engine.motion(0, 0, 0, span('alpha', 10, 100))).toBeNull();
  });
});

describe('load wave', () => {
  test('the wave reaches words further along later, lifts and tints them, then passes', () => {
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startWave(0);
    const at = (t: number, s: { text: string; x: number; y: number }) => {
      engine.beginFrame(t);
      return engine.motion(0, 0, 0, s);
    };
    const near = span('near', 0, 20);
    const far = span('far', 900, 700);
    const first = (s: typeof near) => {
      for (let t = 0; t < WAVE_MS; t += 10) if (at(t, s)) return t;
      return Infinity;
    };
    expect(first(near)).toBeLessThan(first(far));
    let peak = 0;
    for (let t = 0; t < WAVE_MS; t += 5) {
      const m = at(t, near);
      if (m) {
        expect(m.dy).toBeLessThanOrEqual(0);
        peak = Math.max(peak, m.highlight ?? 0);
      }
    }
    expect(peak).toBeGreaterThan(0.9);
    expect(at(WAVE_MS, near)).toBeNull();
    expect(engine.isActive(WAVE_MS)).toBe(false);
  });
});
