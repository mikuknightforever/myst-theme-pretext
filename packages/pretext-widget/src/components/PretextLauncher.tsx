import * as React from 'react';
import { DEFAULT_TEXT_STYLE } from '../layout.js';

export function PretextLauncher({
  blockCount,
  figureCount,
  isDark,
  onOpen,
}: {
  blockCount: number;
  figureCount: number;
  isDark: boolean;
  onOpen: () => void;
}) {
  return (
    <section
      style={{
        margin: '1.5rem 0',
        padding: '18px 20px',
        borderRadius: 18,
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.28)'}`,
        background: isDark ? 'rgba(30,41,59,0.92)' : 'rgba(248,250,252,0.92)',
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 18,
          fontWeight: 800,
          color: isDark ? '#f8fafc' : '#111827',
        }}
      >
        Pretext Mode
      </p>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 14,
          lineHeight: 1.6,
          color: isDark ? '#cbd5e1' : '#475569',
        }}
      >
        {figureCount > 0
          ? `Found ${figureCount} draggable figure${figureCount !== 1 ? 's' : ''}. Open Pretext Mode to drag them — text reflows around all figures simultaneously.`
          : 'Open Pretext Mode to read this article in adjustable columns.'}
      </p>
      {blockCount === 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
          (No article content found in MDAST.)
        </p>
      )}
      <button
        type="button"
        onClick={onOpen}
        style={{
          border: `1px solid ${isDark ? 'rgba(226,232,240,0.3)' : 'rgba(15,23,42,0.18)'}`,
          borderRadius: 999,
          padding: '10px 16px',
          background: isDark ? '#f8fafc' : '#111827',
          color: isDark ? '#0f172a' : '#fff',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Open Pretext Mode
      </button>
    </section>
  );
}
