import * as React from 'react';
import { useReferences } from '@myst-theme/providers';
import { MyST } from 'myst-to-react';
import type { PretextWidget } from './types.js';
import {
  collectParagraphs,
  findAllDraggableNodes,
  layoutParagraphs,
  DEFAULT_TEXT_STYLE,
} from './layout.js';
import type { WordSpan, ObstacleRect } from './layout.js';

const FIGURE_WIDTH_DEFAULT = 280;
const FIGURE_HEIGHT_DEFAULT = 220;
const FIGURE_MIN_W = 120;
const FIGURE_MIN_H = 80;
const OVERLAY_PADDING = 40;

interface FigureInfo {
  mdastNode: any;
  label: string;
}

interface FigurePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragState {
  figIndex: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origW: number;
  origH: number;
  mode: 'move' | 'resize';
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = React.useState(760);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return width;
}

function WordLayer({ spans }: { spans: WordSpan[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {spans.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            fontSize: s.style.fontSize,
            lineHeight: `${s.style.lineHeight}px`,
            fontFamily: s.style.fontFamily,
            fontWeight: s.style.fontWeight,
            color: s.style.color,
            whiteSpace: 'nowrap',
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}

function FigureCard({
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
}) {
  const active = isDragging || isResizing;
  return (
    <div
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
        background: '#f8fafc',
        boxSizing: 'border-box',
        overflow: 'hidden',
        boxShadow: active
          ? '0 20px 50px rgba(37,99,235,0.25)'
          : '0 4px 16px rgba(0,0,0,0.08)',
        transition: active ? 'none' : 'box-shadow 120ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Label badge */}
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

      {/*
        Render the figure using MyST's own renderer.
        Reset layout styles that were designed for the article flow
        (float, margin, max-width) so the node fits the card.
      */}
      {/* Visual content: inside `legend` if present, otherwise all non-caption children */}
      <div style={{ width: '100%', pointerEvents: 'none', float: 'none', margin: 0 }}>
        {(() => {
          const children: any[] = fig.mdastNode?.children ?? [];
          const legend = children.find((c) => c.type === 'legend');
          const content = legend
            ? legend.children
            : children.filter((c) => c.type !== 'caption');
          return <MyST ast={content} />;
        })()}
      </div>
      {/* Caption from the `caption` child */}
      {(() => {
        const cap = (fig.mdastNode?.children ?? []).find((c: any) => c.type === 'caption');
        if (!cap) return null;
        return (
          <div
            style={{
              padding: '6px 10px 8px',
              fontSize: 11,
              lineHeight: 1.4,
              color: '#475569',
              borderTop: '1px solid rgba(148,163,184,0.25)',
              pointerEvents: 'none',
            }}
          >
            <MyST ast={cap.children} />
          </div>
        );
      })()}

      {/* Resize handle — bottom-right corner */}
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
          <line x1="4" y1="13" x2="13" y2="4" stroke="rgba(37,99,235,0.85)" strokeWidth="2" strokeLinecap="round"/>
          <line x1="8" y1="13" x2="13" y2="8" stroke="rgba(37,99,235,0.85)" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

interface OverlayProps {
  paragraphs: string[];
  figures: FigureInfo[];
  onClose: () => void;
}

function PretextOverlay({ paragraphs, figures, onClose }: OverlayProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(contentRef as React.RefObject<HTMLDivElement>);

  const [figPositions, setFigPositions] = React.useState<FigurePosition[]>(() =>
    figures.map((_, i) => ({
      x: containerWidth - FIGURE_WIDTH_DEFAULT - 24,
      y: 40 + i * (FIGURE_HEIGHT_DEFAULT + 32),
      width: FIGURE_WIDTH_DEFAULT,
      height: FIGURE_HEIGHT_DEFAULT,
    })),
  );

  const dragRef = React.useRef<DragState | null>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);
  const [resizingIdx, setResizingIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    setFigPositions((prev) =>
      prev.map((p) => ({ ...p, x: containerWidth - p.width - 24 })),
    );
  }, [containerWidth]);

  React.useEffect(() => {
    setFigPositions(
      figures.map((_, i) => ({
        x: containerWidth - FIGURE_WIDTH_DEFAULT - 24,
        y: 40 + i * (FIGURE_HEIGHT_DEFAULT + 32),
        width: FIGURE_WIDTH_DEFAULT,
        height: FIGURE_HEIGHT_DEFAULT,
      })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figures.length]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const obstacles: ObstacleRect[] = figPositions.map((p) => ({
    left: p.x,
    top: p.y,
    right: p.x + p.width,
    bottom: p.y + p.height,
  }));

  const spans = React.useMemo(
    () =>
      typeof document !== 'undefined'
        ? layoutParagraphs(paragraphs, obstacles, containerWidth - OVERLAY_PADDING * 2, 0, {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 16,
            lineHeight: 26,
            paragraphGap: 20,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paragraphs, containerWidth, JSON.stringify(figPositions)],
  );

  const contentHeight = spans.length > 0 ? Math.max(...spans.map((s) => s.y)) + 80 : 400;

  function startDrag(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = figPositions[idx];
    dragRef.current = {
      figIndex: idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: pos.width,
      origH: pos.height,
      mode: 'move',
    };
    setDraggingIdx(idx);
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    const pos = figPositions[idx];
    dragRef.current = {
      figIndex: idx,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: pos.width,
      origH: pos.height,
      mode: 'resize',
    };
    setResizingIdx(idx);
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const { figIndex, startX, startY, origX, origY, origW, origH, mode } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    setFigPositions((prev) => {
      const next = [...prev];
      const cur = prev[figIndex];
      if (mode === 'move') {
        next[figIndex] = {
          ...cur,
          x: Math.max(0, Math.min(containerWidth - cur.width, origX + dx)),
          y: Math.max(0, origY + dy),
        };
      } else {
        next[figIndex] = {
          ...cur,
          width: Math.max(FIGURE_MIN_W, origW + dx),
          height: Math.max(FIGURE_MIN_H, origH + dy),
        };
      }
      return next;
    });
  }

  function endDrag() {
    dragRef.current = null;
    setDraggingIdx(null);
    setResizingIdx(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        display: 'flex',
        flexDirection: 'column',
        background: 'Canvas',
        color: 'CanvasText',
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
      }}
    >
      <header
        style={{
          height: 68,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid rgba(148,163,184,0.3)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Pretext Mode
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {figures.length} draggable figure{figures.length !== 1 ? 's' : ''} · rendered via MyST
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: '1px solid rgba(15,23,42,0.2)',
            borderRadius: 999,
            padding: '10px 16px',
            background: '#111827',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Exit Pretext Mode
        </button>
      </header>

      <div style={{ flex: 1, overflow: 'auto', background: 'Canvas' }}>
        <div
          ref={contentRef}
          style={{
            position: 'relative',
            maxWidth: 820,
            margin: '0 auto',
            padding: `${OVERLAY_PADDING}px`,
            minHeight: contentHeight,
            boxSizing: 'border-box',
          }}
        >
          <WordLayer spans={spans} />

          {figures.map((fig, i) => (
            <FigureCard
              key={i}
              index={i}
              fig={fig}
              pos={figPositions[i] ?? { x: 0, y: 0, width: FIGURE_WIDTH_DEFAULT, height: FIGURE_HEIGHT_DEFAULT }}
              isDragging={draggingIdx === i}
              isResizing={resizingIdx === i}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onResizePointerDown={startResize}
            />
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          left: 24,
          bottom: 18,
          padding: '8px 12px',
          borderRadius: 999,
          background: 'rgba(15,23,42,0.78)',
          color: 'white',
          fontSize: 12,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
        }}
      >
        Drag to move · drag corner handle to resize · text reflows · Esc to exit
      </div>
    </div>
  );
}

export function PretextWidgetRenderer({ node }: { node: PretextWidget }) {
  const references = useReferences();
  const [open, setOpen] = React.useState(false);

  const draggableSelector = node.draggableSelector ?? 'pretext-draggable';

  const { paragraphs, figures } = React.useMemo(() => {
    const mdast = (references as any)?.article;
    if (!mdast) return { paragraphs: [], figures: [] };

    const paras = collectParagraphs(mdast);
    const figNodes = findAllDraggableNodes(mdast, draggableSelector);

    const figs: FigureInfo[] = figNodes.map((figNode, i) => ({
      mdastNode: figNode,
      label: `Figure ${i + 1}`,
    }));

    return { paragraphs: paras, figures: figs };
  }, [references, draggableSelector]);

  return (
    <>
      <section
        style={{
          margin: '1.5rem 0',
          padding: '18px 20px',
          borderRadius: 18,
          border: '1px solid rgba(148,163,184,0.28)',
          background: 'rgba(248,250,252,0.92)',
          fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: '#111827' }}>
          Pretext Mode
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.6, color: '#475569' }}>
          {figures.length > 0
            ? `Found ${figures.length} draggable figure${figures.length !== 1 ? 's' : ''}. Open Pretext Mode to drag them — text reflows around all figures simultaneously.`
            : 'Open Pretext Mode to see this article with draggable figures.'}
        </p>
        {paragraphs.length === 0 && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
            (No article content found in MDAST.)
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: '1px solid rgba(15,23,42,0.18)',
            borderRadius: 999,
            padding: '10px 16px',
            background: '#111827',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Open Pretext Mode
        </button>
      </section>

      {open && (
        <PretextOverlay
          paragraphs={paragraphs}
          figures={figures}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
