import * as React from 'react';
import { MyST } from 'myst-to-react';
import type { FigureInfo, FigurePosition } from '../model.js';
import { figureParts } from '../content-detection.js';
import { FIGURE_INLINE_MAX_W, INTERACTIVE_FIGURE_HEADER_H } from '../config.js';

/** Render an output at article width and scale it into the card. MyST output
 * wrappers cap themselves at their container's width, and charts such as Plotly
 * often have a fixed authored width, so rendering at the card's width would
 * clip them instead of shrinking them. A fixed render width also keeps the
 * measured aspect ratio independent of the card's size. */
function ScaledOutput({
  body,
  width,
  height,
  onNaturalSize,
}: {
  body: any[];
  width: number;
  height: number;
  onNaturalSize?: (ratio: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const report = () => {
      // Offset sizes ignore the transform, so this is the unscaled output.
      const w = element.offsetWidth;
      const h = element.offsetHeight;
      if (w <= 0 || h <= 0) return;
      setNatural((current) => (current?.w === w && current?.h === h ? current : { w, h }));
      onNaturalSize?.(h / w);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onNaturalSize]);
  const scale = natural ? Math.min(width / natural.w, height / natural.h) : 1;
  const left = natural ? Math.max(0, Math.round((width - natural.w * scale) / 2)) : 0;
  return (
    <div
      ref={ref}
      className="pretext-figure-output"
      style={{
        position: 'absolute',
        top: 0,
        left,
        width: FIGURE_INLINE_MAX_W,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        visibility: natural ? 'visible' : 'hidden',
      }}
    >
      <MyST ast={body} />
    </div>
  );
}

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
  onCaptionHeightChange,
  onNaturalRatioChange,
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
  onCaptionHeightChange?: (index: number, height: number) => void;
  onNaturalRatioChange?: (index: number, ratio: number) => void;
}) {
  const active = isDragging || isResizing;
  const { body, captions } = figureParts(fig.mdastNode);
  const captionRef = React.useRef<HTMLDivElement>(null);
  const interactive = Boolean(fig.interactive);
  const [captionHeight, setCaptionHeight] = React.useState(0);
  const reportNaturalRatio = React.useCallback(
    (ratio: number) => onNaturalRatioChange?.(index, ratio),
    [index, onNaturalRatioChange],
  );
  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => onPointerDown(e, index),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
  const badge = (
    <div
      style={{
        position: interactive ? 'static' : 'absolute',
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
  );
  React.useLayoutEffect(() => {
    const element = captionRef.current;
    if (!element) return;
    if (!onCaptionHeightChange || !pos.inline) {
      setCaptionHeight(element.offsetHeight);
      return;
    }
    const report = () => {
      setCaptionHeight(element.offsetHeight);
      onCaptionHeightChange(index, Math.ceil(element.offsetHeight) + 4);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, pos.inline, onCaptionHeightChange]);
  return (
    <div
      className="pretext-figure-card"
      id={fig.mdastNode?.html_id ?? fig.mdastNode?.identifier}
      data-pretext-figure-index={index}
      {...(interactive ? {} : dragHandlers)}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: pos.width,
        height: pos.height,
        cursor: interactive ? 'default' : isDragging ? 'grabbing' : 'grab',
        zIndex: active ? 50 : 30,
        touchAction: interactive ? 'auto' : 'none',
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
      {interactive ? (
        <div
          data-pretext-drag-handle=""
          aria-label={`Drag ${fig.label}`}
          {...dragHandlers}
          style={{
            flexShrink: 0,
            height: INTERACTIVE_FIGURE_HEADER_H,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            borderBottom: '1px solid rgba(148,163,184,0.25)',
            background: isDark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.06)',
          }}
        >
          {badge}
          <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true">
            {[2, 8, 14].map((cx) =>
              [2, 8].map((cy) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.5" fill="rgba(37,99,235,0.7)" />
              )),
            )}
          </svg>
        </div>
      ) : (
        badge
      )}

      <div
        className="pretext-figure-body"
        data-pretext-interactive={interactive ? '' : undefined}
        style={{
          position: interactive ? 'relative' : undefined,
          width: '100%',
          minHeight: 0,
          flex: '1 1 auto',
          pointerEvents: interactive ? 'auto' : 'none',
          float: 'none',
          margin: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {interactive ? (
          <ScaledOutput
            // The whole container, minus its caption (shown below by the card), goes
            // through MyST's own figure renderer, which adds the notebook source bar
            // and compute controls (e.g. the power button) around the output. The
            // card root already carries the figure's id, so the copy drops it.
            body={[{ ...fig.mdastNode, html_id: undefined, identifier: undefined, children: body }]}
            width={Math.max(1, pos.width - 4)}
            height={Math.max(1, pos.height - 4 - INTERACTIVE_FIGURE_HEADER_H - captionHeight)}
            onNaturalSize={reportNaturalRatio}
          />
        ) : (
          <MyST ast={body} />
        )}
      </div>
      {(() => {
        if (!captions.length) return null;
        return (
          <div
            ref={captionRef}
            className="pretext-figure-caption"
            style={{
              flexShrink: 0,
              padding: '6px 10px 8px',
              fontSize: 11,
              lineHeight: 1.4,
              color: isDark ? '#cbd5e1' : '#475569',
              borderTop: '1px solid rgba(148,163,184,0.25)',
              pointerEvents: 'auto',
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {captions.map((caption, i) => (
              <MyST key={caption.key ?? i} ast={caption.children} />
            ))}
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
