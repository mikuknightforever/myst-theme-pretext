import { describe, expect, test } from 'vitest';
import { EffectsEngine, TRANSITION_MS } from './engine.js';

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

describe('load wave (text doing a Mexican wave)', () => {
  test('words further along stand up later, then sit back down, and the wave ends', async () => {
    const { WAVE_MS } = await import('./engine.js');
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startWave(0);
    const lift = (t: number, s: { text: string; x: number; y: number }) => {
      engine.beginFrame(t);
      return engine.motion(0, 0, 0, s)?.dy ?? 0;
    };
    const firstUp = (s: { text: string; x: number; y: number }) => {
      for (let t = 0; t < WAVE_MS; t += 8) if (lift(t, s) < -0.5) return t;
      return Infinity;
    };
    const near = span('near', 0, 20);
    const far = span('far', 900, 700);
    expect(firstUp(near)).toBeLessThan(firstUp(far));
    expect(firstUp(far)).toBeLessThan(WAVE_MS);
    let highest = 0;
    for (let t = 0; t < WAVE_MS; t += 4) highest = Math.min(highest, lift(t, near));
    expect(highest).toBeLessThan(-5); // it really stands up
    expect(lift(WAVE_MS, near)).toBe(0);
    expect(engine.isActive(WAVE_MS)).toBe(false);
  });

  test('words below the view are left alone', () => {
    const engine = new EffectsEngine();
    engine.setView(0, 800);
    engine.startWave(0);
    for (let t = 0; t < 1200; t += 16) {
      engine.beginFrame(t);
      expect(engine.motion(0, 0, 0, span('off', 10, 2000))).toBeNull();
    }
  });
});
