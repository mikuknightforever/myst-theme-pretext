import * as React from 'react';
import { GLASS_FONT, glassTheme } from './glass.js';

/** A gentle, one-time introduction shown at the top of the reader. */
export function WelcomeCard({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const theme = glassTheme(isDark);
  const button = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => button.current?.focus({ preventScroll: true }), []);
  const paragraph: React.CSSProperties = { margin: '0 0 10px', fontSize: 14, lineHeight: 1.55 };
  return (
    <div
      role="dialog"
      aria-labelledby="pretext-welcome-title"
      style={{
        ...theme.surface,
        background: isDark ? 'rgba(28,25,23,0.86)' : 'rgba(255,255,255,0.86)',
        position: 'absolute',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 110,
        width: 'min(520px, calc(100% - 32px))',
        boxSizing: 'border-box',
        padding: '22px 24px 18px',
        borderRadius: 22,
        fontFamily: GLASS_FONT,
        color: theme.text,
        animation: 'pretext-welcome-in 420ms ease-out 250ms both',
      }}
    >
      <style>{`
        @keyframes pretext-welcome-in {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <h2
        id="pretext-welcome-title"
        style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}
      >
        Welcome to Evidence Pretext Reader!
      </h2>
      <p style={paragraph}>
        This reader lays out the article itself instead of leaving it to the browser, so changes
        happen instantly. You can read in one to four columns, justify the text, or change the text
        size and spacing.
      </p>
      <p style={paragraph}>
        You can also <strong>drag any figure to another place in the text</strong>, and the text
        moves around it. To resize a figure, drag its bottom-right corner.
      </p>
      <p style={{ ...paragraph, color: theme.muted, fontSize: 13 }}>
        The Evidence logo floats over the text and fires its leaves. Click the logo to fire them
        yourself. You can change or turn off this effect in the toolbar at the bottom.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          ref={button}
          type="button"
          onClick={onClose}
          className="pretext-glass-btn"
          style={{
            height: 36,
            padding: '0 18px',
            border: 0,
            borderRadius: 14,
            background: theme.accentBg,
            color: theme.accent,
            fontFamily: GLASS_FONT,
            fontSize: 13,
            fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          Start reading
        </button>
      </div>
    </div>
  );
}
