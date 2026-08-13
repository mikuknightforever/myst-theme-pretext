import * as React from 'react';
import { ColumnSelector } from '../ColumnSelector.js';
import type { ColumnCount } from '../column-layout.js';

export function PretextToolbar({
  figureCount,
  columnCount,
  maxColumnCount,
  isDark,
  onColumnChange,
  onThemeChange,
  onClose,
}: {
  figureCount: number;
  columnCount: ColumnCount;
  maxColumnCount: ColumnCount;
  isDark: boolean;
  onColumnChange: (value: ColumnCount) => void;
  onThemeChange: () => void;
  onClose: () => void;
}) {
  return (
    <header
      style={{
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
