import * as React from 'react';
import type { ColumnCount } from './column-layout.js';

const COLUMN_OPTIONS: ColumnCount[] = [1, 2, 3];

export function ColumnSelector({
  value,
  maxColumns,
  onChange,
  isDark,
}: {
  value: ColumnCount;
  maxColumns: ColumnCount;
  onChange: (count: ColumnCount) => void;
  isDark: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Article columns"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        padding: 3,
        border: `1px solid ${isDark ? 'rgba(226,232,240,0.28)' : 'rgba(15,23,42,0.16)'}`,
        borderRadius: 999,
        background: isDark ? 'rgba(30,41,59,0.82)' : 'rgba(248,250,252,0.9)',
      }}
    >
      <span
        style={{
          paddingLeft: 7,
          paddingRight: 3,
          fontSize: 11,
          color: isDark ? '#94a3b8' : '#64748b',
          userSelect: 'none',
        }}
      >
        Columns
      </span>
      {COLUMN_OPTIONS.map((count) => {
        const selected = value === count;
        const disabled = count > maxColumns;
        return (
          <button
            key={count}
            type="button"
            aria-label={`${count} column${count === 1 ? '' : 's'}`}
            aria-pressed={selected}
            disabled={disabled}
            title={
              disabled
                ? 'The reading area is too narrow for this column count'
                : `${count} column${count === 1 ? '' : 's'}`
            }
            onClick={() => onChange(count)}
            style={{
              width: 30,
              height: 30,
              border: 0,
              borderRadius: 999,
              background: selected
                ? isDark
                  ? '#f8fafc'
                  : '#111827'
                : 'transparent',
              color: selected
                ? isDark
                  ? '#0f172a'
                  : '#ffffff'
                : isDark
                  ? '#cbd5e1'
                  : '#334155',
              opacity: disabled ? 0.35 : 1,
              fontSize: 12,
              fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {count}
          </button>
        );
      })}
    </div>
  );
}
