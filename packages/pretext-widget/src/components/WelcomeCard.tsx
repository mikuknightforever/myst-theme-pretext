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
        background: isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.86)',
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
        This reader arranges the article itself, in the blink of an eye, the way a magazine designer
        would. Pick one to four columns, justified text or a different text size, and every line is
        placed again instantly.
      </p>
      <p style={paragraph}>
        Figures are yours to arrange. <strong>Drag a figure to move it anywhere in the text</strong>
        , and the words flow around it. Pull its bottom-right corner to make it bigger or smaller.
      </p>
      <p style={{ ...paragraph, color: theme.muted, fontSize: 13 }}>
        Tip: move your mouse quickly across the words and watch them scatter. The toolbar at the
        bottom has more effects and settings.
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
