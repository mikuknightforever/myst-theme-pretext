import * as React from 'react';
import type { ColumnCount } from './column-layout.js';
import { glassTheme } from './components/glass.js';

const COLUMN_OPTIONS: ColumnCount[] = [1, 2, 3, 4];

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
  const theme = glassTheme(isDark);
  return (
    <div
      role="group"
      aria-label="Article columns"
      style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
    >
      <span
        style={{
          padding: '0 6px 0 4px',
          fontSize: 11,
          fontWeight: 500,
          color: theme.muted,
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
            className="pretext-glass-btn"
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
              borderRadius: 12,
              background: selected ? theme.accentBg : 'transparent',
              color: selected ? theme.accent : theme.text,
              opacity: disabled ? 0.3 : 1,
              fontSize: 12,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
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
