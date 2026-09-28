import { describe, expect, test } from 'vitest';
import { loadStoredFlag, saveStoredFlag, WELCOME_SEEN_KEY } from './preferences.js';
import { loadOutlineHidden, saveOutlineHidden } from './outline-preference.js';

function memoryStorage() {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

describe('welcome card', () => {
  test('shows until the reader dismisses it, then stays dismissed', () => {
    const storage = memoryStorage();
    expect(loadStoredFlag(storage, WELCOME_SEEN_KEY)).toBe(false);
    saveStoredFlag(storage, WELCOME_SEEN_KEY, true);
    expect(loadStoredFlag(storage, WELCOME_SEEN_KEY)).toBe(true);
  });

  test('blocked storage still shows it, without errors', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadStoredFlag(blocked, WELCOME_SEEN_KEY)).toBe(false);
    expect(() => saveStoredFlag(blocked, WELCOME_SEEN_KEY, true)).not.toThrow();
  });

  test('the outline preference keeps its own key', () => {
    const storage = memoryStorage();
    saveOutlineHidden(storage, true);
    expect(loadOutlineHidden(storage)).toBe(true);
    expect(loadStoredFlag(storage, WELCOME_SEEN_KEY)).toBe(false);
  });
});
