import * as React from 'react';
import { useThemeSwitcher } from '@myst-theme/providers';
import {
  layoutBlocksInColumns,
  type ColumnCount,
  type ColumnLayoutOptions,
} from '../column-layout.js';
import {
  COLUMN_GAP,
  COLUMN_MIN_WIDTH,
  FIGURE_MIN_H,
  FIGURE_MIN_W,
  OVERLAY_PADDING,
  PRETEXT_TEXT_STYLE,
} from '../config.js';
import { FigureCard } from '../figures/FigureCard.js';
import { buildInitialFigurePositions, toObstacleRects } from '../figure-layout.js';
import { useContainerWidth, useImageRatios, useMediaQuery } from '../hooks.js';
import { getOpeningLayout } from '../layout-cache.js';
import { DEFAULT_TEXT_STYLE } from '../layout.js';
import type { ContentBlock, HeadingAnchor, LayoutResult, ObstacleRect } from '../layout.js';
import type { DragState, FigureInfo, FigureLayoutState } from '../model.js';
import { MathCodeLayer } from '../layers/MathCodeLayer.js';
import { RichBlockLayer } from '../layers/RichBlockLayer.js';
import { WordCanvas } from '../layers/WordCanvas.js';
import { PretextOutline } from './PretextOutline.js';
import { PretextToolbar } from './PretextToolbar.js';

const EMPTY_LAYOUT: LayoutResult = {
  spans: [],
  richBlocks: [],
  figureAnchors: [],
  headingAnchors: [],
  contentBottom: 0,
};

interface OverlayProps {
  blocks: ContentBlock[];
  figures: FigureInfo[];
  onClose: () => void;
}

export const PretextOverlay = React.memo(function PretextOverlay({
  blocks,
  figures,
  onClose,
}: OverlayProps) {
  const { isDark, nextTheme } = useThemeSwitcher();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(contentRef as React.RefObject<HTMLDivElement>);
  const showOutline = useMediaQuery('(min-width: 1180px)');
  const [requestedColumnCount, setRequestedColumnCount] = React.useState<ColumnCount>(1);
  const maxColumnCount = Math.max(
    1,
    Math.min(
      3,
      Math.floor((Math.max(0, containerWidth) + COLUMN_GAP) / (COLUMN_MIN_WIDTH + COLUMN_GAP)),
    ),
  ) as ColumnCount;
  const columnCount = Math.min(requestedColumnCount, maxColumnCount) as ColumnCount;
  const columnOptions: ColumnLayoutOptions = {
    count: columnCount,
    gap: COLUMN_GAP,
  };

  const [figureLayout, setFigureLayout] = React.useState<FigureLayoutState | null>(null);
  const imageRatios = useImageRatios(figures);
  const figPositions =
    figureLayout?.width === containerWidth && figureLayout?.columns === columnCount
      ? figureLayout.positions
      : null;
  const initialLayoutRef = React.useRef(true);
  const hasInteractedRef = React.useRef(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const pendingColumnHeadingRef = React.useRef<string | null>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);
  const [resizingIdx, setResizingIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined' || containerWidth <= 0) return;
    const layoutModeChanged =
      figureLayout != null &&
      (figureLayout.width !== containerWidth || figureLayout.columns !== columnCount);
    if (layoutModeChanged) hasInteractedRef.current = false;
    if (
      hasInteractedRef.current &&
      figureLayout?.width === containerWidth &&
      figureLayout?.columns === columnCount
    ) {
      return;
    }
    initialLayoutRef.current = true;
    setFigureLayout({
      width: containerWidth,
      columns: columnCount,
      positions: buildInitialFigurePositions(
        blocks,
        figures,
        containerWidth,
        imageRatios,
        columnOptions,
      ),
    });
  }, [
    blocks,
    figures,
    containerWidth,
    imageRatios,
    columnCount,
    figureLayout?.width,
    figureLayout?.columns,
  ]);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const obstacles: ObstacleRect[] = figPositions
    ? toObstacleRects(figPositions, containerWidth)
    : [];

  const positionKey =
    figPositions
      ?.map(
        (p) =>
          `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.width)},${Math.round(p.height)},${p.inline ? 1 : 0}`,
      )
      .join(';') ?? '';
  const { spans, richBlocks, headingAnchors } = React.useMemo(() => {
    if (typeof document === 'undefined' || containerWidth <= 0 || !figPositions) {
      return EMPTY_LAYOUT;
    }
    const calculate = () =>
      layoutBlocksInColumns(
        blocks,
        obstacles,
        containerWidth,
        0,
        PRETEXT_TEXT_STYLE,
        columnOptions,
      );
    if (!initialLayoutRef.current) return calculate();
    return getOpeningLayout(
      blocks,
      `initial:${Math.round(containerWidth)}:${columnCount}:${COLUMN_GAP}:${positionKey}`,
      calculate,
    );
    // `positionKey` captures every obstacle coordinate without depending on a
    // newly allocated obstacles array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, containerWidth, columnCount, positionKey]);

  React.useEffect(() => {
    const pendingHeadingId = pendingColumnHeadingRef.current;
    const scrollContainer = scrollRef.current;
    if (!pendingHeadingId || !scrollContainer) return;
    const target = headingAnchors.find((heading) => heading.id === pendingHeadingId);
    if (!target) return;
    scrollContainer.scrollTop = Math.max(0, target.y - 16);
    pendingColumnHeadingRef.current = null;
  }, [headingAnchors]);

  // Avoid Math.max(...largeArray) stack overflow — use a loop instead.
  const contentHeight = React.useMemo(() => {
    let max = 400;
    for (const s of spans) {
      const bottom = s.y + s.style.lineHeight + 80;
      if (bottom > max) max = bottom;
    }
    for (const b of richBlocks) {
      const bottom = b.y + b.estimatedHeight + 80;
      if (bottom > max) max = bottom;
    }
    for (const p of figPositions ?? []) {
      const bottom = p.y + p.height + 80;
      if (bottom > max) max = bottom;
    }
    return max;
  }, [spans, richBlocks, figPositions]);

  function changeColumnCount(nextCount: ColumnCount) {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    let activeHeading: HeadingAnchor | undefined;
    for (const heading of headingAnchors) {
      if (heading.y <= scrollTop + 80) activeHeading = heading;
      else break;
    }
    pendingColumnHeadingRef.current = activeHeading?.id ?? null;
    setRequestedColumnCount(nextCount);
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    if (!figPositions) return;
    hasInteractedRef.current = true;
    initialLayoutRef.current = false;
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
    if (!figPositions) return;
    hasInteractedRef.current = true;
    initialLayoutRef.current = false;
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
    setFigureLayout((prev) => {
      if (!prev || prev.width !== containerWidth) return prev;
      const next = [...prev.positions];
      const cur = prev.positions[figIndex];
      if (mode === 'move') {
        next[figIndex] = {
          ...cur,
          x: Math.max(0, Math.min(containerWidth - cur.width, origX + dx)),
          y: Math.max(0, origY + dy),
          inline: false,
        };
      } else {
        next[figIndex] = {
          ...cur,
          width: Math.min(containerWidth, Math.max(FIGURE_MIN_W, origW + dx)),
          height: Math.max(FIGURE_MIN_H, origH + dy),
          inline: false,
        };
      }
      return { ...prev, positions: next };
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
        // Leave the browser's maximum z-index available to body-level MyST
        // hover-card portals (abbreviations, citations and cross-references).
        zIndex: 2147483646,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#e5e7eb' : '#111827',
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
      }}
    >
      <style>
        {`
          .pretext-figure-card figure,
          .pretext-figure-card .figure {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .pretext-figure-body > * {
            width: 100%;
            max-width: 100%;
          }
          .pretext-figure-body img,
          .pretext-figure-body svg {
            display: block;
            max-width: 100% !important;
            max-height: 100% !important;
            width: auto;
            height: auto;
            object-fit: contain;
            margin: 0 auto;
          }
          .pretext-figure-card figcaption {
            display: none;
          }
        `}
      </style>
      <PretextToolbar
        figureCount={figures.length}
        columnCount={columnCount}
        maxColumnCount={maxColumnCount}
        isDark={isDark}
        onColumnChange={changeColumnCount}
        onThemeChange={nextTheme}
        onClose={onClose}
      />

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          background: isDark ? '#0f172a' : '#ffffff',
        }}
      >
        <div
          style={{
            maxWidth: showOutline ? 1640 : 1400,
            margin: '0 auto',
            padding: `0 24px`,
            display: 'grid',
            gridTemplateColumns: showOutline ? 'minmax(0, 1fr) 250px' : 'minmax(0, 1fr)',
            gap: showOutline ? 28 : 0,
            alignItems: 'start',
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={contentRef}
            style={{
              position: 'relative',
              padding: `${OVERLAY_PADDING}px`,
              minHeight: contentHeight,
              boxSizing: 'border-box',
            }}
          >
            <WordCanvas
              spans={spans}
              width={containerWidth}
              scrollContainerRef={scrollRef}
              isDark={isDark}
            />
            <MathCodeLayer spans={spans} scrollContainerRef={scrollRef} isDark={isDark} />
            <RichBlockLayer richBlocks={richBlocks} scrollContainerRef={scrollRef} />

            {figPositions &&
              figures.map((fig, i) => (
                <FigureCard
                  key={i}
                  index={i}
                  fig={fig}
                  pos={figPositions[i]}
                  isDragging={draggingIdx === i}
                  isResizing={resizingIdx === i}
                  onPointerDown={startDrag}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onResizePointerDown={startResize}
                  isDark={isDark}
                />
              ))}
          </div>
          {showOutline && (
            <aside
              style={{
                position: 'sticky',
                top: 24,
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
                marginTop: 40,
                padding: '16px 12px',
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 12,
                background: isDark ? 'rgba(30,41,59,0.88)' : 'rgba(248,250,252,0.82)',
                boxSizing: 'border-box',
              }}
            >
              <PretextOutline
                headings={headingAnchors}
                scrollContainerRef={scrollRef}
                isDark={isDark}
              />
            </aside>
          )}
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
});
