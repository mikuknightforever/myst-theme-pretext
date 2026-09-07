import * as React from 'react';
import { useThemeSwitcher } from '@myst-theme/providers';
import { type ColumnCount, type ColumnLayoutOptions } from '../column-layout.js';
import {
  COLUMN_GAP,
  COLUMN_MIN_WIDTH,
  COLUMN_PAGE_GAP,
  COLUMN_PAGE_HEIGHT,
  FIGURE_MIN_H,
  FIGURE_MIN_W,
  OVERLAY_PADDING,
} from '../config.js';
import { FigureCard } from '../figures/FigureCard.js';
import { buildInitialFigurePositions, layoutWithFigures } from '../figure-layout.js';
import { useContainerWidth, useImageRatios, useMediaQuery } from '../hooks.js';
import { DEFAULT_TEXT_STYLE, inlineMeasurementKey, styleForBlock } from '../layout.js';
import type { ContentBlock, HeadingAnchor, InlineMetrics, LayoutResult } from '../layout.js';
import type { DragState, FigureInfo, FigureLayoutState } from '../model.js';
import { readingSettingsKey, readingTextStyle, type ReadingSettings } from '../reading-settings.js';
import { useReadingSettings } from '../useReadingSettings.js';
import { InlineMeasurementLayer, MathCodeLayer } from '../layers/MathCodeLayer.js';
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
const EMPTY_HEIGHTS: Record<number, number> = {};

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
  const { settings: readingSettings, updateSettings, resetSettings } = useReadingSettings();
  const readingKey = readingSettingsKey(readingSettings);
  const textStyle = React.useMemo(() => readingTextStyle(readingSettings), [readingKey]);
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
    columnHeight: COLUMN_PAGE_HEIGHT,
    bandGap: COLUMN_PAGE_GAP,
  };

  const [figureLayout, setFigureLayout] = React.useState<FigureLayoutState | null>(null);
  const richMeasurementScope = `${Math.round(containerWidth)}:${columnCount}:${readingKey}`;
  const [richMeasurements, setRichMeasurements] = React.useState<{
    scope: string;
    heights: Record<number, number>;
  }>({ scope: '', heights: {} });
  const richBlockHeights =
    richMeasurements.scope === richMeasurementScope ? richMeasurements.heights : EMPTY_HEIGHTS;
  const [inlineMetrics, setInlineMetrics] = React.useState<Record<string, InlineMetrics>>({});
  const [captionMeasurements, setCaptionMeasurements] = React.useState<{
    scope: string;
    heights: Record<number, number>;
  }>({ scope: '', heights: {} });
  const captionHeights =
    captionMeasurements.scope === richMeasurementScope
      ? captionMeasurements.heights
      : EMPTY_HEIGHTS;
  const updateCaptionHeight = React.useCallback(
    (index: number, height: number) => {
      setCaptionMeasurements((current) => {
        const heights = current.scope === richMeasurementScope ? current.heights : {};
        if (heights[index] === height) return current;
        return { scope: richMeasurementScope, heights: { ...heights, [index]: height } };
      });
    },
    [richMeasurementScope],
  );
  const measuredBlocks = React.useMemo(() => {
    let fallbackIndex = 0;
    return blocks.map((block) => {
      if (block.type === 'richBlock') {
        const index = block.richBlockIndex ?? fallbackIndex;
        fallbackIndex += 1;
        const measuredHeight = richBlockHeights[index];
        return measuredHeight == null ? block : { ...block, estimatedHeight: measuredHeight };
      }
      if (block.type === 'figureAnchor') return block;
      const blockStyle = styleForBlock(block, textStyle);
      let changed = false;
      const words = block.words.map((word) => {
        if (!word.math && !word.code && !word.semanticNode) return word;
        const metrics = inlineMetrics[inlineMeasurementKey(word, blockStyle)];
        if (!metrics) {
          return word;
        }
        changed = true;
        return { ...word, measuredWidth: metrics.width, measuredHeight: metrics.height };
      });
      return changed ? { ...block, words } : block;
    });
  }, [blocks, inlineMetrics, richBlockHeights, textStyle]);
  const imageRatios = useImageRatios(figures);
  const manualPositions =
    figureLayout?.width === containerWidth &&
    figureLayout?.columns === columnCount &&
    figureLayout?.readingKey === readingKey
      ? figureLayout.positions
      : null;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const pendingLayoutHeadingRef = React.useRef<string | null>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);
  const [resizingIdx, setResizingIdx] = React.useState<number | null>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { layout, positions: figPositions } = React.useMemo(() => {
    if (typeof document === 'undefined' || containerWidth <= 0) {
      return { layout: EMPTY_LAYOUT, positions: null };
    }
    const initial = buildInitialFigurePositions(
      measuredBlocks,
      figures,
      containerWidth,
      imageRatios,
      columnOptions,
      textStyle,
      captionHeights,
    );
    const candidates = initial.map((position, index) =>
      manualPositions?.[index] && !manualPositions[index].inline
        ? manualPositions[index]
        : position,
    );
    return layoutWithFigures(measuredBlocks, candidates, containerWidth, textStyle, columnOptions);
  }, [
    measuredBlocks,
    figures,
    containerWidth,
    imageRatios,
    columnCount,
    textStyle,
    manualPositions,
    captionHeights,
  ]);
  const { spans, richBlocks, headingAnchors } = layout;

  const updateRichBlockHeight = React.useCallback(
    (index: number, height: number) => {
      setRichMeasurements((current) => {
        const heights = current.scope === richMeasurementScope ? current.heights : {};
        if (Math.abs((heights[index] ?? 0) - height) < 2) {
          return current.scope === richMeasurementScope
            ? current
            : { scope: richMeasurementScope, heights };
        }
        return {
          scope: richMeasurementScope,
          heights: { ...heights, [index]: height },
        };
      });
    },
    [richMeasurementScope],
  );

  const updateInlineMetrics = React.useCallback((metrics: Record<string, InlineMetrics>) => {
    setInlineMetrics((current) => {
      const changed = Object.entries(metrics).some(
        ([key, value]) =>
          current[key]?.width !== value.width || current[key]?.height !== value.height,
      );
      return changed ? { ...current, ...metrics } : current;
    });
  }, []);

  React.useEffect(() => {
    const pendingHeadingId = pendingLayoutHeadingRef.current;
    const scrollContainer = scrollRef.current;
    if (!pendingHeadingId || !scrollContainer) return;
    const target = headingAnchors.find((heading) => heading.id === pendingHeadingId);
    if (!target) return;
    scrollContainer.scrollTop = Math.max(0, target.y - 16);
    pendingLayoutHeadingRef.current = null;
  }, [headingAnchors]);

  // Avoid Math.max(...largeArray) stack overflow — use a loop instead.
  const contentHeight = React.useMemo(() => {
    let max = 400;
    for (const s of spans) {
      const bottom = s.y + (s.height ?? s.style.lineHeight) + 80;
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

  function rememberReadingPosition() {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    let activeHeading: HeadingAnchor | undefined;
    for (const heading of headingAnchors) {
      if (heading.y <= scrollTop + 80) activeHeading = heading;
      else break;
    }
    pendingLayoutHeadingRef.current = activeHeading?.id ?? null;
  }

  function changeColumnCount(nextCount: ColumnCount) {
    rememberReadingPosition();
    setRequestedColumnCount(nextCount);
  }

  function changeReadingSettings(patch: Partial<ReadingSettings>) {
    rememberReadingPosition();
    updateSettings(patch);
  }

  function restoreReadingSettings() {
    rememberReadingPosition();
    resetSettings();
  }

  function startDrag(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    if (!figPositions) return;
    setFigureLayout({
      width: containerWidth,
      columns: columnCount,
      readingKey,
      positions: figPositions,
    });
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
    setFigureLayout({
      width: containerWidth,
      columns: columnCount,
      readingKey,
      positions: figPositions,
    });
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
        readingSettings={readingSettings}
        onColumnChange={changeColumnCount}
        onReadingSettingsChange={changeReadingSettings}
        onReadingSettingsReset={restoreReadingSettings}
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
            maxWidth: readingSettings.readingWidth + (showOutline ? 240 : 0),
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
            {layout.columnBands?.map((band, index) => (
              <div
                key={index}
                className="pretext-band-boundary"
                data-pretext-band-index={index}
                data-pretext-band-top={band.top}
                data-pretext-band-bottom={band.bottom}
                data-pretext-column-bottoms={JSON.stringify(band.columnBottoms)}
                data-pretext-breaks={JSON.stringify(band.breaks)}
                role={index ? 'separator' : undefined}
                aria-label={index ? "Continue from the previous group's last column" : undefined}
                aria-hidden={index ? undefined : true}
                style={{
                  position: 'absolute',
                  top: band.top - COLUMN_PAGE_GAP / 2,
                  left: 0,
                  width: containerWidth,
                  borderTop: index ? '1px solid rgba(148,163,184,0.28)' : undefined,
                  pointerEvents: 'none',
                }}
              />
            ))}
            <WordCanvas
              spans={spans}
              width={containerWidth}
              scrollContainerRef={scrollRef}
              isDark={isDark}
            />
            <InlineMeasurementLayer
              blocks={blocks}
              textStyle={textStyle}
              onMetricsChange={updateInlineMetrics}
            />
            <MathCodeLayer spans={spans} scrollContainerRef={scrollRef} isDark={isDark} />
            <RichBlockLayer
              richBlocks={richBlocks}
              textStyle={textStyle}
              onHeightChange={updateRichBlockHeight}
            />

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
                  onCaptionHeightChange={updateCaptionHeight}
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
          flex: '0 0 auto',
          padding: '6px 24px 8px',
          borderTop: '1px solid rgba(148,163,184,0.2)',
          background: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#cbd5e1' : '#475569',
          fontSize: 12,
          lineHeight: 1.35,
          pointerEvents: 'none',
        }}
      >
        Drag to move · drag corner handle to resize · text reflows · Esc to exit
      </div>
    </div>
  );
});
