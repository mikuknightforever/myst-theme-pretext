import * as React from 'react';
import { MyST } from 'myst-to-react';
import type { FigureInfo, FigurePosition } from '../model.js';

export function FigureCard({
  fig,
  pos,
  isDragging,
  isResizing,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onResizePointerDown,
  index,
  isDark,
}: {
  fig: FigureInfo;
  pos: FigurePosition;
  isDragging: boolean;
  isResizing: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, idx: number) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>, idx: number) => void;
  index: number;
  isDark: boolean;
}) {
  const active = isDragging || isResizing;
  return (
    <div
      className="pretext-figure-card"
      onPointerDown={(e) => onPointerDown(e, index)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: active ? 50 : 30,
        touchAction: 'none',
        userSelect: 'none',
        borderRadius: 16,
        border: `2px solid ${active ? 'rgba(37,99,235,0.9)' : 'rgba(37,99,235,0.4)'}`,
        background: isDark ? '#1e293b' : '#f8fafc',
        color: isDark ? '#e5e7eb' : '#111827',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: active ? '0 20px 50px rgba(37,99,235,0.25)' : '0 4px 16px rgba(0,0,0,0.08)',
        transition: active ? 'none' : 'box-shadow 120ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          padding: '2px 8px',
          borderRadius: 999,
          background: 'rgba(37,99,235,0.85)',
          color: 'white',
          fontSize: 11,
          fontWeight: 700,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {fig.label}
      </div>

      <div
        className="pretext-figure-body"
        style={{
          width: '100%',
          minHeight: 0,
          flex: '1 1 auto',
          pointerEvents: 'none',
          float: 'none',
          margin: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {(() => {
          const children: any[] = fig.mdastNode?.children ?? [];
          const legend = children.find((c) => c.type === 'legend');
          const content = legend ? legend.children : children.filter((c) => c.type !== 'caption');
          return <MyST ast={content} />;
        })()}
      </div>
      {(() => {
        const cap = (fig.mdastNode?.children ?? []).find((c: any) => c.type === 'caption');
        if (!cap) return null;
        return (
          <div
            style={{
              padding: '6px 10px 8px',
              fontSize: 11,
              lineHeight: 1.4,
              color: isDark ? '#cbd5e1' : '#475569',
              borderTop: '1px solid rgba(148,163,184,0.25)',
              pointerEvents: 'none',
            }}
          >
            <MyST ast={cap.children} />
          </div>
        );
      })()}

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 28,
          height: 28,
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTopLeftRadius: 8,
          background: isResizing ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.18)',
          zIndex: 30,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          onResizePointerDown(e, index);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="rgba(37,99,235,0.85)">
          <line
            x1="4"
            y1="13"
            x2="13"
            y2="4"
            stroke="rgba(37,99,235,0.85)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="13"
            x2="13"
            y2="8"
            stroke="rgba(37,99,235,0.85)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
