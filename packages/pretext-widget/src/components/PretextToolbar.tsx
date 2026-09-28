import * as React from 'react';
import { ColumnSelector } from '../ColumnSelector.js';
import type { ColumnCount } from '../column-layout.js';
import type { ReadingSettings } from '../reading-settings.js';
import { ReadingSettingsPanel } from './ReadingSettingsPanel.js';

export function PretextToolbar({
  figureCount,
  columnCount,
  maxColumnCount,
  isDark,
  readingSettings,
  onColumnChange,
  onReadingSettingsChange,
  onReadingSettingsReset,
  onThemeChange,
  outlineToggleAvailable = false,
  outlineHidden = false,
  onOutlineToggle,
  funMode = false,
  funModeAvailable = true,
  onFunModeToggle,
  onClose,
}: {
  figureCount: number;
  columnCount: ColumnCount;
  maxColumnCount: ColumnCount;
  isDark: boolean;
  readingSettings: ReadingSettings;
  onColumnChange: (value: ColumnCount) => void;
  onReadingSettingsChange: (patch: Partial<ReadingSettings>) => void;
  onReadingSettingsReset: () => void;
  onThemeChange: () => void;
  /** The outline only has room on wide screens, so the toggle only shows there. */
  outlineToggleAvailable?: boolean;
  outlineHidden?: boolean;
  onOutlineToggle?: () => void;
  funMode?: boolean;
  /** False when the reader's system asks for reduced motion. */
  funModeAvailable?: boolean;
  onFunModeToggle?: () => void;
  onClose: () => void;
}) {
  const roundButton = (pressed: boolean): React.CSSProperties => ({
    width: 42,
    height: 42,
    border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
    borderRadius: 999,
    background: pressed
      ? isDark
        ? 'rgba(96,165,250,0.2)'
        : 'rgba(37,99,235,0.1)'
      : isDark
        ? '#1e293b'
        : '#ffffff',
    color: isDark ? '#f8fafc' : '#111827',
    display: 'grid',
    placeItems: 'center',
    fontSize: 18,
    cursor: 'pointer',
  });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const settingsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!settingsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [settingsOpen]);

  return (
    <header
      style={{
        position: 'relative',
        zIndex: 100,
        height: 68,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid rgba(148,163,184,0.3)',
        background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>Pretext Mode</div>
        <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
          {figureCount} draggable figure{figureCount !== 1 ? 's' : ''} · rendered via MyST
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ColumnSelector
          value={columnCount}
          maxColumns={maxColumnCount}
          onChange={onColumnChange}
          isDark={isDark}
        />
        <div ref={settingsRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Reading settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((current) => !current)}
            style={{
              height: 42,
              minWidth: 48,
              border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
              borderRadius: 999,
              background: settingsOpen
                ? isDark
                  ? 'rgba(96,165,250,0.2)'
                  : 'rgba(37,99,235,0.1)'
                : isDark
                  ? '#1e293b'
                  : '#ffffff',
              color: isDark ? '#f8fafc' : '#111827',
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontSize: 17,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Aa
          </button>
          {settingsOpen && (
            <ReadingSettingsPanel
              settings={readingSettings}
              isDark={isDark}
              onChange={onReadingSettingsChange}
              onReset={onReadingSettingsReset}
            />
          )}
        </div>
        {onFunModeToggle && (
          <button
            type="button"
            onClick={onFunModeToggle}
            disabled={!funModeAvailable}
            aria-pressed={funMode}
            title={
              funModeAvailable
                ? funMode
                  ? 'Turn off fun mode'
                  : 'Fun mode: click the text to explode it'
                : 'Fun mode is off because your system asks for reduced motion'
            }
            aria-label="Fun mode"
            style={{
              ...roundButton(funMode),
              opacity: funModeAvailable ? 1 : 0.45,
              cursor: funModeAvailable ? 'pointer' : 'not-allowed',
            }}
          >
            <span aria-hidden="true">✦</span>
          </button>
        )}
        {outlineToggleAvailable && onOutlineToggle && (
          <button
            type="button"
            onClick={onOutlineToggle}
            aria-pressed={!outlineHidden}
            title={outlineHidden ? 'Show "On this page"' : 'Hide "On this page"'}
            aria-label={outlineHidden ? 'Show "On this page"' : 'Hide "On this page"'}
            style={roundButton(!outlineHidden)}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <rect
                x="1.5"
                y="2.5"
                width="15"
                height="13"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="11.5"
                y1="2.5"
                x2="11.5"
                y2="15.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              {!outlineHidden && (
                <rect
                  x="11.5"
                  y="2.5"
                  width="5"
                  height="13"
                  rx="1"
                  fill="currentColor"
                  opacity="0.35"
                />
              )}
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onThemeChange}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: 42,
            height: 42,
            border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
            borderRadius: 999,
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#111827',
            display: 'grid',
            placeItems: 'center',
            fontSize: 20,
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
        </button>
        <button
          onClick={onClose}
          style={{
            border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
            borderRadius: 999,
            padding: '10px 16px',
            background: isDark ? '#f8fafc' : '#111827',
            color: isDark ? '#0f172a' : '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Exit Pretext Mode
        </button>
      </div>
    </header>
  );
}
