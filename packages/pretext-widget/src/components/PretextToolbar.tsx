import * as React from 'react';
import { ColumnSelector } from '../ColumnSelector.js';
import type { ColumnCount } from '../column-layout.js';
import type { EffectMode } from '../effects/engine.js';
import type { ReadingSettings } from '../reading-settings.js';
import { GLASS_FONT, glassButtonCss, glassTheme, type GlassTheme } from './glass.js';
import { ReadingSettingsPanel } from './ReadingSettingsPanel.js';

/** Space the floating toolbar needs at the bottom, including its offset. */
export const TOOLBAR_CLEARANCE = 88;

type Popover = 'columns' | 'settings' | null;

function IconButton({
  theme,
  pressed,
  expanded,
  disabled = false,
  label,
  title,
  onClick,
  children,
}: {
  theme: GlassTheme;
  pressed?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  label: string;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const on = Boolean(pressed || expanded);
  return (
    <button
      type="button"
      className="pretext-glass-btn"
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        border: 0,
        borderRadius: 14,
        background: on ? theme.accentBg : 'transparent',
        color: on ? theme.accent : theme.text,
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

const Icon = {
  columns: (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
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
      <line x1="6.5" y1="2.5" x2="6.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="11.5" y1="2.5" x2="11.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  justify: (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      {[4, 7.5, 11, 14.5].map((y, i) => (
        <line
          key={y}
          x1="2.5"
          y1={y}
          x2={i === 3 ? 10 : 15.5}
          y2={y}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  ),
  outline: (
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
      <line x1="11.5" y1="2.5" x2="11.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  none: (
    <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>
      –
    </span>
  ),
  scatter: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  magnify: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line
        x1="15.5"
        y1="15.5"
        x2="21"
        y2="21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  explode: <span aria-hidden="true">✦</span>,
};

const EFFECTS: Array<{ mode: EffectMode; label: string }> = [
  { mode: 'none', label: 'No text effect' },
  { mode: 'scatter', label: 'Scatter: words flee the cursor' },
  { mode: 'magnify', label: 'Magnify: words grow under the cursor' },
  { mode: 'explode', label: 'Explode: click the text' },
];

export function PretextToolbar({
  figureCount,
  columnCount,
  maxColumnCount,
  isDark,
  readingSettings,
  onColumnChange,
  onReadingSettingsChange,
  onReadingSettingsReset,
  outlineToggleAvailable = false,
  outlineHidden = false,
  onOutlineToggle,
  effectMode = 'none',
  effectsAvailable = true,
  onEffectModeChange,
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
  /** The outline only has room on wide screens, so the toggle only shows there. */
  outlineToggleAvailable?: boolean;
  outlineHidden?: boolean;
  onOutlineToggle?: () => void;
  effectMode?: EffectMode;
  /** False when the reader's system asks for reduced motion. */
  effectsAvailable?: boolean;
  onEffectModeChange?: (mode: EffectMode) => void;
  onClose: () => void;
}) {
  const theme = glassTheme(isDark);
  const [popover, setPopover] = React.useState<Popover>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const toggle = (next: Popover) => setPopover((current) => (current === next ? null : next));
  const justified = readingSettings.textAlign === 'justify';

  React.useEffect(() => {
    if (!popover) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setPopover(null);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [popover]);

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Pretext Mode"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        maxWidth: 'calc(100% - 32px)',
        fontFamily: GLASS_FONT,
      }}
    >
      <style>{glassButtonCss(theme)}</style>
      {popover === 'columns' && (
        <div
          role="dialog"
          aria-label="Columns"
          style={{
            ...theme.surface,
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: 0,
            padding: 5,
            borderRadius: 18,
          }}
        >
          <ColumnSelector
            value={columnCount}
            maxColumns={maxColumnCount}
            onChange={(count) => {
              onColumnChange(count);
              setPopover(null);
            }}
            isDark={isDark}
          />
        </div>
      )}
      {popover === 'settings' && (
        <ReadingSettingsPanel
          settings={readingSettings}
          isDark={isDark}
          onChange={onReadingSettingsChange}
          onReset={onReadingSettingsReset}
        />
      )}
      <div
        className="pretext-glass-row"
        style={{
          ...theme.surface,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 6px 5px 8px',
          borderRadius: 28,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          boxSizing: 'border-box',
        }}
      >
        <span
          title={`${figureCount} draggable figure${figureCount !== 1 ? 's' : ''} · drag figures to move, their corner to resize · Esc to exit`}
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
        <IconButton
          theme={theme}
          label={`Columns: ${columnCount}`}
          expanded={popover === 'columns'}
          onClick={() => toggle('columns')}
        >
          {Icon.columns}
        </IconButton>
        <IconButton
          theme={theme}
          label="Justify text"
          title={
            justified ? 'Justified (click for left aligned)' : 'Left aligned (click to justify)'
          }
          pressed={justified}
          onClick={() => onReadingSettingsChange({ textAlign: justified ? 'left' : 'justify' })}
        >
          {Icon.justify}
        </IconButton>
        <IconButton
          theme={theme}
          label="Reading settings"
          expanded={popover === 'settings'}
          onClick={() => toggle('settings')}
        >
          <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }}>
            Aa
          </span>
        </IconButton>
        {onEffectModeChange && (
          <>
            <Divider theme={theme} />
            <span role="radiogroup" aria-label="Text effect" style={{ display: 'flex', gap: 2 }}>
              {EFFECTS.map(({ mode, label }) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  className="pretext-glass-btn"
                  aria-checked={effectMode === mode}
                  aria-label={label}
                  title={
                    effectsAvailable
                      ? label
                      : 'Text effects are off because your system asks for reduced motion'
                  }
                  disabled={!effectsAvailable && mode !== 'none'}
                  onClick={() => onEffectModeChange(mode)}
                  style={{
                    width: 36,
                    height: 36,
                    border: 0,
                    borderRadius: 14,
                    background: effectMode === mode ? theme.accentBg : 'transparent',
                    color: effectMode === mode ? theme.accent : theme.text,
                    display: 'grid',
                    placeItems: 'center',
                    opacity: !effectsAvailable && mode !== 'none' ? 0.4 : 1,
                    cursor: !effectsAvailable && mode !== 'none' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {Icon[mode]}
                </button>
              ))}
            </span>
          </>
        )}
        <Divider theme={theme} />
        {outlineToggleAvailable && onOutlineToggle && (
          <IconButton
            theme={theme}
            label={outlineHidden ? 'Show "On this page"' : 'Hide "On this page"'}
            pressed={!outlineHidden}
            onClick={onOutlineToggle}
          >
            {Icon.outline}
          </IconButton>
        )}

        <button
          type="button"
          className="pretext-glass-btn"
          aria-label="Exit Pretext Mode"
          title="Exit Pretext Mode (Esc)"
          onClick={onClose}
          style={{
            height: 36,
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
    </div>
  );
}
