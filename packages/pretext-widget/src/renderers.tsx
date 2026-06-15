import * as React from 'react';
import { useReferences } from '@myst-theme/providers';
import type { PretextWidget } from './types.js';
import {
  collectParagraphs,
  findDraggableNode,
  findImageUrl,
  layoutParagraphs,
  DEFAULT_TEXT_STYLE,
} from './layout.js';
import type { WordSpan, ObstacleRect } from './layout.js';

const FIGURE_WIDTH = 320;
const FIGURE_HEIGHT = 200;
const OVERLAY_PADDING = 40;

interface DragState {
  startX: number;
  startY: number;
  origFigX: number;
  origFigY: number;
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

interface OverlayProps {
  paragraphs: string[];
  figureImageUrl: string | null;
  figureHtml: string | null;
  onClose: () => void;
}

function PretextOverlay({ paragraphs, figureImageUrl, figureHtml, onClose }: OverlayProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(contentRef as React.RefObject<HTMLDivElement>);

  const [figPos, setFigPos] = React.useState({ x: containerWidth - FIGURE_WIDTH - 24, y: 40 });
  const dragRef = React.useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Reposition figure when container resizes
  React.useEffect(() => {
    setFigPos((prev) => ({ ...prev, x: containerWidth - FIGURE_WIDTH - 24 }));
  }, [containerWidth]);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const obstacle: ObstacleRect = {
    left: figPos.x,
    top: figPos.y,
    right: figPos.x + FIGURE_WIDTH,
    bottom: figPos.y + FIGURE_HEIGHT,
  };

  const spans = React.useMemo(
    () =>
      typeof document !== 'undefined'
        ? layoutParagraphs(paragraphs, obstacle, containerWidth - OVERLAY_PADDING * 2, 0, {
            ...DEFAULT_TEXT_STYLE,
            fontSize: 16,
            lineHeight: 26,
            paragraphGap: 20,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paragraphs, figPos.x, figPos.y, containerWidth],
  );

  const contentHeight = spans.length > 0 ? Math.max(...spans.map((s) => s.y)) + 80 : 400;

  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origFigX: figPos.x,
      origFigY: figPos.y,
    };
    setIsDragging(true);
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setFigPos({
      x: Math.max(0, Math.min(containerWidth - FIGURE_WIDTH, dragRef.current.origFigX + dx)),
      y: Math.max(0, dragRef.current.origFigY + dy),
    });
  }

  function endDrag() {
    dragRef.current = null;
    setIsDragging(false);
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
      {/* Top bar */}
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
            Drag the figure to reflow text — powered by MyST MDAST data
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

      {/* Scrollable content */}
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
          {/* Word-level reflow layer */}
          <WordLayer spans={spans} />

          {/* Draggable figure */}
          <div
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'absolute',
              left: figPos.x,
              top: figPos.y,
              width: FIGURE_WIDTH,
              height: FIGURE_HEIGHT,
              cursor: isDragging ? 'grabbing' : 'grab',
              zIndex: 30,
              touchAction: 'none',
              userSelect: 'none',
              borderRadius: 16,
              border: '2px solid rgba(37,99,235,0.4)',
              background: '#f8fafc',
              boxSizing: 'border-box',
              overflow: 'hidden',
              boxShadow: isDragging ? '0 20px 50px rgba(37,99,235,0.25)' : undefined,
            }}
          >
            {figureImageUrl ? (
              <img
                src={figureImageUrl}
                alt="Pretext figure"
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                draggable={false}
              />
            ) : figureHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: figureHtml }}
                style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg,#111827,#2563eb)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: 18,
                }}
              >
                Draggable Figure
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
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
        Drag the figure · text reflows from MDAST data · Esc to exit
      </div>
    </div>
  );
}

export function PretextWidgetRenderer({ node }: { node: PretextWidget }) {
  const references = useReferences();
  const [open, setOpen] = React.useState(false);

  const draggableSelector = node.draggableSelector ?? 'pretext-draggable';

  const { paragraphs, figureImageUrl, figureHtml } = React.useMemo(() => {
    const mdast = (references as any)?.article;
    if (!mdast) return { paragraphs: [], figureImageUrl: null, figureHtml: null };

    const paras = collectParagraphs(mdast);
    const figNode = findDraggableNode(mdast, draggableSelector);
    const imgUrl = figNode ? findImageUrl(figNode) : null;

    // Fallback: capture raw html value if it's an html-type node
    const rawHtml = figNode?.type === 'html' ? figNode.value ?? null : null;

    return { paragraphs: paras, figureImageUrl: imgUrl, figureHtml: rawHtml };
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
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 800,
            color: '#111827',
          }}
        >
          Pretext Mode
        </p>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            lineHeight: 1.6,
            color: '#475569',
          }}
        >
          Open Pretext Mode to see this article with a draggable figure. Text reflows around the
          figure using MyST's structured document data — no DOM cloning.
        </p>
        {paragraphs.length === 0 && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
            (No article content found in MDAST — check that this directive is inside an article
            page.)
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
          figureImageUrl={figureImageUrl}
          figureHtml={figureHtml}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
