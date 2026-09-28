import * as React from 'react';
import { ColumnSelector } from '../ColumnSelector.js';
import type { ColumnCount } from '../column-layout.js';
import type { ReadingSettings } from '../reading-settings.js';
import { GLASS_FONT, glassButtonCss, glassTheme, type GlassTheme } from './glass.js';
import { ReadingSettingsPanel } from './ReadingSettingsPanel.js';

/** Height the floating toolbar occupies, including its offset from the top. */
export const TOOLBAR_CLEARANCE = 80;

function IconButton({
  theme,
  pressed = false,
  disabled = false,
  label,
  title,
  onClick,
  children,
  expanded,
}: {
  theme: GlassTheme;
  pressed?: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className="pretext-glass-btn"
      aria-label={label}
      aria-pressed={expanded == null ? pressed : undefined}
      aria-expanded={expanded}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        flexShrink: 0,
        border: 0,
        borderRadius: 14,
        background: pressed || expanded ? theme.accentBg : 'transparent',
        color: pressed || expanded ? theme.accent : theme.text,
        display: 'grid',
        placeItems: 'center',
        fontFamily: GLASS_FONT,
        fontSize: 15,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

function Divider({ theme }: { theme: GlassTheme }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 1, height: 20, flexShrink: 0, background: theme.divider, margin: '0 4px' }}
    />
  );
}

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
  const theme = glassTheme(isDark);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!settingsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [settingsOpen]);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Pretext Mode"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        maxWidth: 'calc(100% - 32px)',
        fontFamily: GLASS_FONT,
      }}
    >
      <style>{glassButtonCss(theme)}</style>
      <div
        className="pretext-glass-row"
        style={{
          ...theme.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px 4px 8px',
          borderRadius: 28,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          boxSizing: 'border-box',
        }}
      >
        <span
          title={`${figureCount} draggable figure${figureCount !== 1 ? 's' : ''} · rendered via MyST`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px 0 6px',
            flexShrink: 0,
            fontSize: 13,
            fontWeight: 650,
            letterSpacing: '-0.01em',
            color: theme.text,
            whiteSpace: 'nowrap',
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 3, height: 16, borderRadius: 2, background: theme.accent }}
          />
          Pretext
        </span>
        <Divider theme={theme} />
        <ColumnSelector
          value={columnCount}
          maxColumns={maxColumnCount}
          onChange={onColumnChange}
          isDark={isDark}
        />
        <Divider theme={theme} />
        <IconButton
          theme={theme}
          label="Reading settings"
          expanded={settingsOpen}
          onClick={() => setSettingsOpen((current) => !current)}
        >
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }}>
            Aa
          </span>
        </IconButton>
        {onFunModeToggle && (
          <IconButton
            theme={theme}
            label="Fun mode"
            pressed={funMode}
            disabled={!funModeAvailable}
            title={
              funModeAvailable
                ? funMode
                  ? 'Turn off fun mode'
                  : 'Fun mode: click the text to explode it'
                : 'Fun mode is off because your system asks for reduced motion'
            }
            onClick={onFunModeToggle}
          >
            <span aria-hidden="true">✦</span>
          </IconButton>
        )}
        {outlineToggleAvailable && onOutlineToggle && (
          <IconButton
            theme={theme}
            label={outlineHidden ? 'Show "On this page"' : 'Hide "On this page"'}
            pressed={!outlineHidden}
            onClick={onOutlineToggle}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
              <rect
                x="1.5"
                y="2.5"
                width="15"
                height="13"
                rx="2.5"
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
            </svg>
          </IconButton>
        )}
        <IconButton
          theme={theme}
          label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={onThemeChange}
        >
          <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
        </IconButton>
        <Divider theme={theme} />
        <button
          type="button"
          className="pretext-glass-btn"
          aria-label="Exit Pretext Mode"
          title="Exit Pretext Mode (Esc)"
          onClick={onClose}
          style={{
            height: 34,
            flexShrink: 0,
            padding: '0 14px',
            border: 0,
            borderRadius: 14,
            background: 'transparent',
            color: theme.muted,
            fontFamily: GLASS_FONT,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          Exit
        </button>
      </div>
      {settingsOpen && (
        <ReadingSettingsPanel
          settings={readingSettings}
          isDark={isDark}
          onChange={onReadingSettingsChange}
          onReset={onReadingSettingsReset}
        />
      )}
    </div>
  );
}
