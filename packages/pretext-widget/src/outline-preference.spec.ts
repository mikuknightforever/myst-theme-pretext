import { describe, expect, test } from 'vitest';
import { loadOutlineHidden, saveOutlineHidden } from './outline-preference.js';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('"On this page" visibility preference', () => {
  test('the outline is shown unless the reader hid it', () => {
    expect(loadOutlineHidden(memoryStorage())).toBe(false);
    expect(loadOutlineHidden(undefined)).toBe(false);
  });

  test('hiding it is remembered', () => {
    const storage = memoryStorage();
    saveOutlineHidden(storage, true);
    expect(loadOutlineHidden(storage)).toBe(true);
    saveOutlineHidden(storage, false);
    expect(loadOutlineHidden(storage)).toBe(false);
  });

  test('unreadable or unavailable storage falls back to showing it', () => {
    expect(loadOutlineHidden(memoryStorage({ 'myst-pretext-outline-hidden-v1': 'nonsense' }))).toBe(
      false,
    );
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadOutlineHidden(throwing)).toBe(false);
    expect(() => saveOutlineHidden(throwing, true)).not.toThrow();
  });
});
