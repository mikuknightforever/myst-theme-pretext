import * as React from 'react';
import {
  browserStorage,
  loadStoredFlag,
  saveStoredFlag,
  type PreferenceStorage,
} from './preferences.js';

const STORAGE_KEY = 'myst-pretext-outline-hidden-v1';

/** Whether the reader hid the "On this page" panel. Shown unless explicitly hidden. */
export function loadOutlineHidden(storage: PreferenceStorage | undefined): boolean {
  return loadStoredFlag(storage, STORAGE_KEY);
}

export function saveOutlineHidden(storage: PreferenceStorage | undefined, hidden: boolean): void {
  saveStoredFlag(storage, STORAGE_KEY, hidden);
}

export function useOutlineHidden(): [boolean, () => void] {
  const [hidden, setHidden] = React.useState(() => loadOutlineHidden(browserStorage()));
  React.useEffect(() => saveOutlineHidden(browserStorage(), hidden), [hidden]);
  const toggle = React.useCallback(() => setHidden((current) => !current), []);
  return [hidden, toggle];
}
