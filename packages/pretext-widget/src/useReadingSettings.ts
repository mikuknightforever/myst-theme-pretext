import * as React from 'react';
import {
  DEFAULT_READING_SETTINGS,
  normalizeReadingSettings,
  type ReadingSettings,
} from './reading-settings.js';

const STORAGE_KEY = 'myst-pretext-reading-settings-v1';

function loadReadingSettings(): ReadingSettings {
  if (typeof window === 'undefined') return DEFAULT_READING_SETTINGS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeReadingSettings(JSON.parse(stored)) : DEFAULT_READING_SETTINGS;
  } catch {
    return DEFAULT_READING_SETTINGS;
  }
}

export function useReadingSettings() {
  const [settings, setSettings] = React.useState<ReadingSettings>(loadReadingSettings);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Reading settings remain usable even when storage is unavailable.
    }
  }, [settings]);

  const updateSettings = React.useCallback((patch: Partial<ReadingSettings>) => {
    setSettings((current) => normalizeReadingSettings({ ...current, ...patch }));
  }, []);

  const resetSettings = React.useCallback(() => {
    setSettings(DEFAULT_READING_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
