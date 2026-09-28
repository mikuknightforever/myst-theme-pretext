import * as React from 'react';
import { MyST } from 'myst-to-react';
import type { FigureInfo, FigurePosition } from '../model.js';
import { figureParts } from '../content-detection.js';
import { FIGURE_INLINE_MAX_W } from '../config.js';

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

export type CaptionMode = 'inline' | 'collapsed' | 'expanded';

function Chevron({ up }: { up: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d={up ? 'M2 6.5 5 3.5 8 6.5' : 'M2 3.5 5 6.5 8 3.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
  captionMode = 'inline',
  onToggleCaption,
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
  /** Collapsed on cards too small for their caption; expanded adds it below. */
  captionMode?: CaptionMode;
  onToggleCaption?: (index: number) => void;
}) {
  const active = isDragging || isResizing;
  const { body, captions } = figureParts(fig.mdastNode);
  const captionRef = React.useRef<HTMLDivElement>(null);
  const interactive = Boolean(fig.interactive);
  const [captionHeight, setCaptionHeight] = React.useState(0);
  const collapsed = captionMode === 'collapsed';
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
  // The caption is always rendered, hidden when collapsed, so its height is
  // known for deciding when to collapse and how much an opened one adds.
  React.useLayoutEffect(() => {
    const element = captionRef.current;
    if (!element) return;
    const report = () => {
      setCaptionHeight(element.offsetHeight);
      onCaptionHeightChange?.(index, Math.ceil(element.offsetHeight) + 4);
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [index, onCaptionHeightChange]);
  const chip: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 22,
    padding: '0 8px',
    border: 0,
    borderRadius: 999,
    background: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.88)',
    color: isDark ? '#e2e8f0' : '#334155',
    boxShadow: '0 1px 4px rgba(15,23,42,0.18)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
  };
  const toggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    onToggleCaption?.(index);
  };
  return (
    <div
      className="pretext-figure-card"
      id={fig.mdastNode?.html_id ?? fig.mdastNode?.identifier}
      data-pretext-figure-index={index}
      data-active={active ? '' : undefined}
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
        background: isDark ? '#1e293b' : '#f8fafc',
        color: isDark ? '#e5e7eb' : '#111827',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {interactive && (
        <div
          data-pretext-drag-handle=""
          className="pretext-card-chrome"
          aria-label={`Move ${fig.label}`}
          title="Drag to move"
          {...dragHandlers}
          style={{
            position: 'absolute',
            top: 6,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 44,
            height: 18,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            touchAction: 'none',
            background: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.9)',
            boxShadow: '0 1px 4px rgba(15,23,42,0.2)',
          }}
        >
          <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true">
            {[2, 8, 14].map((cx) =>
              [2, 6].map((cy) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill="rgba(37,99,235,0.75)" />
              )),
            )}
          </svg>
        </div>
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
            width={Math.max(1, pos.width)}
            height={Math.max(1, pos.height - (collapsed ? 0 : captionHeight))}
            onNaturalSize={reportNaturalRatio}
          />
        ) : (
          <MyST ast={body} />
        )}
      </div>
      {captions.length > 0 && (
        <div
          ref={captionRef}
          className="pretext-figure-caption"
          aria-hidden={collapsed ? true : undefined}
          style={{
            flexShrink: 0,
            padding: '6px 10px 8px',
            fontSize: 11,
            lineHeight: 1.4,
            color: isDark ? '#cbd5e1' : '#475569',
            borderTop: '1px solid rgba(148,163,184,0.25)',
            pointerEvents: 'auto',
            position: 'relative',
            ...(captionMode === 'expanded' && { paddingRight: 40 }),
            ...(collapsed && {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              visibility: 'hidden',
            }),
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {captions.map((caption, i) => (
            <MyST key={caption.key ?? i} ast={caption.children} />
          ))}
          {captionMode === 'expanded' && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Hide caption"
              title="Hide caption"
              // Top right of the caption: the resize handle owns the bottom corner.
              style={{ ...chip, position: 'absolute', top: 4, right: 6, height: 20, zIndex: 31 }}
            >
              <Chevron up />
            </button>
          )}
        </div>
      )}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label="Show caption"
          title="Show caption"
          style={{ ...chip, position: 'absolute', left: 8, bottom: 8, zIndex: 31 }}
        >
          Caption <Chevron up={false} />
        </button>
      )}

      <div
        className="pretext-card-chrome"
        title="Drag to resize"
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 24,
          height: 24,
          cursor: 'nwse-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTopLeftRadius: 8,
          zIndex: 32,
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
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <line
            x1="3"
            y1="11"
            x2="11"
            y2="3"
            stroke="rgba(37,99,235,0.8)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <line
            x1="7"
            y1="11"
            x2="11"
            y2="7"
            stroke="rgba(37,99,235,0.8)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
