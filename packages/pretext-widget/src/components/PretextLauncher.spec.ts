import { describe, expect, it } from 'vitest';
import { shouldShowLauncherHint } from './PretextLauncher.js';
import { LAUNCHER_HINT_SEEN_KEY, WELCOME_SEEN_KEY } from '../preferences.js';

const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
  setItem: (key: string, value: string) => {
    values[key] = value;
  },
});

describe('shouldShowLauncherHint', () => {
  it('points a first-time reader at the Pretext button', () => {
    expect(shouldShowLauncherHint(storage(), '')).toBe(true);
  });

  it('stays away once dismissed, or once the reader has been opened', () => {
    expect(shouldShowLauncherHint(storage({ [LAUNCHER_HINT_SEEN_KEY]: 'true' }), '')).toBe(false);
    expect(shouldShowLauncherHint(storage({ [WELCOME_SEEN_KEY]: 'true' }), '')).toBe(false);
  });

  it('always shows for a ?tour link, for demonstrations', () => {
    expect(shouldShowLauncherHint(storage({ [LAUNCHER_HINT_SEEN_KEY]: 'true' }), '?tour')).toBe(true);
  });

  it('works when storage is unavailable', () => {
    expect(shouldShowLauncherHint(undefined, '')).toBe(true);
  });
});
