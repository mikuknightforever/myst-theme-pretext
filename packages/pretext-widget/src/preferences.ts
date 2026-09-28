import * as React from 'react';

/** Small on/off reader preferences kept in local storage. Storage can be
 * missing or blocked; the preference then simply uses its default. */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const WELCOME_SEEN_KEY = 'myst-pretext-welcome-seen-v1';

export function loadStoredFlag(storage: PreferenceStorage | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function saveStoredFlag(
  storage: PreferenceStorage | undefined,
  key: string,
  value: boolean,
): void {
  try {
    storage?.setItem(key, String(value));
  } catch {
    // The preference still works for this session when storage is unavailable.
  }
}

export function browserStorage(): PreferenceStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** A stored flag as React state. */
export function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const [value, setValue] = React.useState(() => loadStoredFlag(browserStorage(), key));
  const update = React.useCallback(
    (next: boolean) => {
      setValue(next);
      saveStoredFlag(browserStorage(), key, next);
    },
    [key],
  );
  return [value, update];
}
