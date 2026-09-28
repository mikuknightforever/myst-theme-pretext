import type * as React from 'react';

/** Shared "liquid glass" look for the floating toolbar and its popovers. */
export interface GlassTheme {
  surface: React.CSSProperties;
  text: string;
  muted: string;
  accent: string;
  accentBg: string;
  hoverBg: string;
  divider: string;
}

export const GLASS_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", sans-serif';

export function glassTheme(isDark: boolean): GlassTheme {
  const blur = 'blur(20px) saturate(180%)';
  return isDark
    ? {
        surface: {
          background: 'rgba(10,12,18,0.34)',
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow:
            '0 16px 48px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
          color: '#f0f0f5',
        },
        text: '#f0f0f5',
        muted: '#8a8aa3',
        accent: '#22d3ee',
        accentBg: 'rgba(129,140,248,0.16)',
        hoverBg: 'rgba(255,255,255,0.07)',
        divider: 'rgba(255,255,255,0.1)',
      }
    : {
        surface: {
          background: 'rgba(255,255,255,0.4)',
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow:
            '0 16px 48px rgba(15,23,42,0.14), 0 4px 12px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.7)',
          color: '#0f172a',
        },
        text: '#0f172a',
        muted: '#64748b',
        accent: '#4f46e5',
        accentBg: 'rgba(99,102,241,0.12)',
        hoverBg: 'rgba(15,23,42,0.06)',
        divider: 'rgba(15,23,42,0.1)',
      };
}

/** Hover and focus rules that inline styles cannot express. */
export function glassButtonCss(theme: GlassTheme): string {
  return `
    .pretext-glass-btn { transition: background 120ms ease, color 120ms ease; }
    .pretext-glass-btn:hover:not(:disabled):not([aria-pressed="true"]) { background: ${theme.hoverBg}; }
    .pretext-glass-btn:focus-visible { outline: 2px solid ${theme.accent}; outline-offset: 1px; }
    .pretext-glass-row::-webkit-scrollbar { display: none; }
  `;
}
