import * as React from 'react';
import {
  DEFAULT_READING_SETTINGS,
  READING_SETTING_LIMITS,
  type ReadingSettings,
} from '../reading-settings.js';

interface SettingSliderProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  isDark: boolean;
}

function SettingSlider({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  isDark,
}: SettingSliderProps) {
  const buttonStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.32)'}`,
    borderRadius: 8,
    background: isDark ? 'rgba(15,23,42,0.55)' : '#f8fafc',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: 17,
    lineHeight: 1,
    cursor: 'pointer',
  };
  const stepValue = (direction: -1 | 1) =>
    Number(Math.min(max, Math.max(min, value + direction * step)).toFixed(3));

  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          fontSize: 13,
          color: isDark ? '#e2e8f0' : '#334155',
        }}
      >
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <span style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 28px', gap: 8 }}>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(stepValue(-1))}
          style={{ ...buttonStyle, opacity: value <= min ? 0.45 : 1 }}
        >
          −
        </button>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(stepValue(1))}
          style={{ ...buttonStyle, opacity: value >= max ? 0.45 : 1 }}
        >
          +
        </button>
      </span>
    </label>
  );
}

export function ReadingSettingsPanel({
  settings,
  isDark,
  onChange,
  onReset,
}: {
  settings: ReadingSettings;
  isDark: boolean;
  onChange: (patch: Partial<ReadingSettings>) => void;
  onReset: () => void;
}) {
  const isDefault =
    settings.fontSize === DEFAULT_READING_SETTINGS.fontSize &&
    settings.lineHeight === DEFAULT_READING_SETTINGS.lineHeight &&
    settings.paragraphGap === DEFAULT_READING_SETTINGS.paragraphGap &&
    settings.readingWidth === DEFAULT_READING_SETTINGS.readingWidth;

  return (
    <div
      role="dialog"
      aria-label="Reading settings"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        right: 0,
        width: 300,
        padding: 18,
        display: 'grid',
        gap: 17,
        borderRadius: 14,
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.32)'}`,
        background: isDark ? '#1e293b' : '#ffffff',
        color: isDark ? '#f8fafc' : '#0f172a',
        boxShadow: '0 18px 45px rgba(15,23,42,0.22)',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Reading settings</div>
        <div style={{ marginTop: 3, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          Saved automatically on this device
        </div>
      </div>
      <SettingSlider
        label="Font size"
        value={settings.fontSize}
        displayValue={`${settings.fontSize}px`}
        {...READING_SETTING_LIMITS.fontSize}
        onChange={(fontSize) => onChange({ fontSize })}
        isDark={isDark}
      />
      <SettingSlider
        label="Line height"
        value={settings.lineHeight}
        displayValue={`${settings.lineHeight.toFixed(2)}×`}
        {...READING_SETTING_LIMITS.lineHeight}
        onChange={(lineHeight) => onChange({ lineHeight })}
        isDark={isDark}
      />
      <SettingSlider
        label="Paragraph spacing"
        value={settings.paragraphGap}
        displayValue={`${settings.paragraphGap}px`}
        {...READING_SETTING_LIMITS.paragraphGap}
        onChange={(paragraphGap) => onChange({ paragraphGap })}
        isDark={isDark}
      />
      <SettingSlider
        label="Reading width"
        value={settings.readingWidth}
        displayValue={`${settings.readingWidth}px`}
        {...READING_SETTING_LIMITS.readingWidth}
        onChange={(readingWidth) => onChange({ readingWidth })}
        isDark={isDark}
      />
      <button
        type="button"
        onClick={onReset}
        disabled={isDefault}
        style={{
          justifySelf: 'start',
          border: 0,
          padding: 0,
          background: 'transparent',
          color: isDefault ? (isDark ? '#64748b' : '#94a3b8') : isDark ? '#93c5fd' : '#2563eb',
          fontSize: 13,
          fontWeight: 700,
          cursor: isDefault ? 'default' : 'pointer',
        }}
      >
        Restore defaults
      </button>
    </div>
  );
}
