import * as React from 'react';

const STORAGE_KEY = 'myst-pretext-outline-hidden-v1';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether the reader hid the "On this page" panel. Shown unless explicitly hidden. */
export function loadOutlineHidden(storage: PreferenceStorage | undefined): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveOutlineHidden(storage: PreferenceStorage | undefined, hidden: boolean): void {
  try {
    storage?.setItem(STORAGE_KEY, String(hidden));
  } catch {
    // The toggle still works for this session when storage is unavailable.
  }
}

function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function useOutlineHidden(): [boolean, () => void] {
  const [hidden, setHidden] = React.useState(() => loadOutlineHidden(browserStorage()));
  React.useEffect(() => saveOutlineHidden(browserStorage(), hidden), [hidden]);
  const toggle = React.useCallback(() => setHidden((current) => !current), []);
  return [hidden, toggle];
}
