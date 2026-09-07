import { PRETEXT_TEXT_STYLE } from './config.js';
import type { TextStyle } from './layout.js';

export interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  readingWidth: number;
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: PRETEXT_TEXT_STYLE.fontSize,
  lineHeight: PRETEXT_TEXT_STYLE.lineHeight / PRETEXT_TEXT_STYLE.fontSize,
  paragraphGap: PRETEXT_TEXT_STYLE.paragraphGap,
  readingWidth: 1400,
};

export const READING_SETTING_LIMITS = {
  fontSize: { min: 14, max: 22, step: 1 },
  lineHeight: { min: 1.35, max: 2, step: 0.025 },
  paragraphGap: { min: 12, max: 32, step: 2 },
  readingWidth: { min: 900, max: 1600, step: 50 },
} as const;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export function normalizeReadingSettings(value: unknown): ReadingSettings {
  const settings = value && typeof value === 'object' ? (value as Partial<ReadingSettings>) : {};
  return {
    fontSize: clamp(
      settings.fontSize,
      READING_SETTING_LIMITS.fontSize.min,
      READING_SETTING_LIMITS.fontSize.max,
      DEFAULT_READING_SETTINGS.fontSize,
    ),
    lineHeight: clamp(
      settings.lineHeight,
      READING_SETTING_LIMITS.lineHeight.min,
      READING_SETTING_LIMITS.lineHeight.max,
      DEFAULT_READING_SETTINGS.lineHeight,
    ),
    paragraphGap: clamp(
      settings.paragraphGap,
      READING_SETTING_LIMITS.paragraphGap.min,
      READING_SETTING_LIMITS.paragraphGap.max,
      DEFAULT_READING_SETTINGS.paragraphGap,
    ),
    readingWidth: clamp(
      settings.readingWidth,
      READING_SETTING_LIMITS.readingWidth.min,
      READING_SETTING_LIMITS.readingWidth.max,
      DEFAULT_READING_SETTINGS.readingWidth,
    ),
  };
}

export function readingSettingsKey(settings: ReadingSettings): string {
  return `${settings.fontSize}:${settings.lineHeight.toFixed(2)}:${settings.paragraphGap}:${settings.readingWidth}`;
}

export function readingTextStyle(settings: ReadingSettings): TextStyle {
  return {
    ...PRETEXT_TEXT_STYLE,
    fontSize: settings.fontSize,
    lineHeight: Math.round(settings.fontSize * settings.lineHeight),
    paragraphGap: settings.paragraphGap,
  };
}
