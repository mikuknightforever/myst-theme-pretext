import * as React from 'react';
import { useThemeSwitcher } from '@myst-theme/providers';
import type { ColumnCount } from '../column-layout.js';
import { COLUMN_GAP, COLUMN_MIN_WIDTH, COLUMN_PAGE_GAP, OVERLAY_PADDING } from '../config.js';
import { FigureCard } from '../figures/FigureCard.js';
import { EXPLODE_TOTAL_MS, isBurstActive, type Burst } from '../effects/explode.js';
import { useOutlineHidden } from '../outline-preference.js';
import { advanceIntro, createSettleDetector } from '../effects/intro.js';
import { useContainerWidth, useMediaQuery } from '../hooks.js';
import { usePretextLayout } from '../hooks/usePretextLayout.js';
import { useFigureInteractions } from '../hooks/useFigureInteractions.js';
import { useReadingNavigation } from '../hooks/useReadingNavigation.js';
import { DEFAULT_TEXT_STYLE } from '../layout/types.js';
import type { ContentBlock } from '../layout/types.js';
import type { FigureInfo } from '../model.js';
import type { ReadingSettings } from '../reading-settings.js';
import { useReadingSettings } from '../useReadingSettings.js';
import { InlineMeasurementLayer, MathCodeLayer } from '../layers/MathCodeLayer.js';
import { RichBlockLayer } from '../layers/RichBlockLayer.js';
import { WordCanvas } from '../layers/WordCanvas.js';
import { PretextOutline } from './PretextOutline.js';
import { PretextToolbar, TOOLBAR_CLEARANCE } from './PretextToolbar.js';

interface OverlayProps {
  blocks: ContentBlock[];
  figures: FigureInfo[];
  /** Theme-provided content above the columns, such as the article's title card. */
  header?: React.ReactNode;
  onClose: () => void;
}

export const PretextOverlay = React.memo(function PretextOverlay({
  blocks,
  figures,
  header,
  onClose,
}: OverlayProps) {
  const { isDark, nextTheme } = useThemeSwitcher();
  const { settings: readingSettings, updateSettings, resetSettings } = useReadingSettings();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(contentRef as React.RefObject<HTMLDivElement>);
  const themeFont = React.useMemo(
    () =>
      typeof document === 'undefined' ? undefined : getComputedStyle(document.body).fontFamily,
    [],
  );
  const outlineFits = useMediaQuery('(min-width: 1180px)');
  const [outlineHidden, toggleOutline] = useOutlineHidden();
  const showOutline = outlineFits && !outlineHidden;
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [funMode, setFunMode] = React.useState(false);
  const explodeEnabled = funMode && !reduceMotion;
  const [bursts, setBursts] = React.useState<Burst[]>([]);
  // Grid-snap intro: a frame-driven clock (see advanceIntro). It stays at 0,
  // with words invisible at their starting spots, until the first layout exists.
  const introClock = React.useRef<number | null>(reduceMotion ? null : 0);
  const [introRunning, setIntroRunning] = React.useState(!reduceMotion);
  const burstSeed = React.useRef(1);
  // Drop finished bursts so the canvas animation loop can stop.
  React.useEffect(() => {
    if (bursts.length === 0) return;
    const now = performance.now();
    const nextEnd = Math.min(...bursts.map((burst) => burst.start + EXPLODE_TOTAL_MS));
    const timer = setTimeout(
      () =>
        setBursts((current) => current.filter((burst) => isBurstActive(burst, performance.now()))),
      Math.max(0, nextEnd - now) + 20,
    );
    return () => clearTimeout(timer);
  }, [bursts]);
  const explodeAt = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Plain canvas text has no DOM of its own, so a click on it lands on the
      // content element itself; links, figures, math and code keep their clicks.
      if (!explodeEnabled || event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const burst: Burst = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        start: performance.now(),
        seed: burstSeed.current++,
      };
      setBursts((current) => [...current, burst]);
    },
    [explodeEnabled],
  );
  const [requestedColumnCount, setRequestedColumnCount] = React.useState<ColumnCount>(1);
  const maxColumnCount = Math.max(
    1,
    Math.min(
      3,
      Math.floor((Math.max(0, containerWidth) + COLUMN_GAP) / (COLUMN_MIN_WIDTH + COLUMN_GAP)),
    ),
  ) as ColumnCount;
  const columnCount = Math.min(requestedColumnCount, maxColumnCount) as ColumnCount;

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const {
    layout,
    spans,
    richBlocks,
    headingAnchors,
    figPositions,
    contentHeight,
    readingKey,
    textStyle,
    setFigureLayout,
    updateCaptionHeight,
    updateOutputRatio,
    heightForWidth,
    updateRichBlockHeight,
    updateInlineMetrics,
  } = usePretextLayout({ blocks, figures, containerWidth, columnCount, readingSettings });
  const layoutReady = spans.length > 0 && containerWidth > 0;
  const lastLayoutChange = React.useRef(0);
  React.useEffect(() => {
    lastLayoutChange.current = performance.now();
  }, [spans]);
  React.useEffect(() => {
    if (!introRunning) return;
    if (reduceMotion) {
      introClock.current = null;
      setIntroRunning(false);
      return;
    }
    if (!layoutReady) return;
    let frame = 0;
    let last = performance.now();
    // Words stay hidden (clock at 0) until the page has settled, then play.
    const settle = createSettleDetector();
    let playing = false;
    const tick = (time: number) => {
      const frameMs = time - last;
      last = time;
      if (!playing) playing = settle.frame(frameMs, time - lastLayoutChange.current);
      else introClock.current = advanceIntro(introClock.current, frameMs);
      if (introClock.current == null) setIntroRunning(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [introRunning, layoutReady, reduceMotion]);
  const { draggingIdx, resizingIdx, startDrag, startResize, moveDrag, endDrag } =
    useFigureInteractions({
      figPositions,
      setFigureLayout,
      containerWidth,
      columnCount,
      readingKey,
      heightForWidth,
    });
  const { rememberReadingPosition, followLocalReference } = useReadingNavigation({
    headingAnchors,
    contentRef,
    scrollRef,
  });
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
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
          /* Image-fitting rules; interactive outputs are scaled as a whole instead. */
          .pretext-figure-body:not([data-pretext-interactive]) > * {
            width: 100%;
            max-width: 100%;
          }
          .pretext-figure-body:not([data-pretext-interactive]) img,
          .pretext-figure-body:not([data-pretext-interactive]) svg {
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
        outlineToggleAvailable={outlineFits}
        outlineHidden={outlineHidden}
        onOutlineToggle={toggleOutline}
        funMode={explodeEnabled}
        funModeAvailable={!reduceMotion}
        onFunModeToggle={() => setFunMode((current) => !current)}
        onClose={onClose}
      />

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          background: isDark ? '#0f172a' : '#ffffff',
          // The floating toolbar sits over the top; text scrolls underneath it.
          paddingTop: TOOLBAR_CLEARANCE - 24,
        }}
      >
        {header && (
          <div
            className="pretext-article-header"
            style={{
              // The overlay sets a reading font; the theme's header keeps the page's own.
              fontFamily: themeFont,
              maxWidth: readingSettings.readingWidth + (outlineFits ? 240 : 0),
              margin: '0 auto',
              padding: '24px 24px 0',
              boxSizing: 'border-box',
            }}
          >
            {header}
          </div>
        )}
        <div
          style={{
            // Hiding the outline hands its column to the text.
            maxWidth: readingSettings.readingWidth + (outlineFits ? 240 : 0),
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
            onClickCapture={followLocalReference}
            onClick={explodeAt}
            style={{
              position: 'relative',
              cursor: explodeEnabled ? 'crosshair' : undefined,
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
              bursts={bursts}
              introClock={introClock}
              introRunning={introRunning}
            />
            <InlineMeasurementLayer
              blocks={blocks}
              textStyle={textStyle}
              onMetricsChange={updateInlineMetrics}
            />
            <MathCodeLayer
              spans={spans}
              scrollContainerRef={scrollRef}
              isDark={isDark}
              bursts={bursts}
              introClock={introClock}
              introRunning={introRunning}
            />
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
                  onNaturalRatioChange={updateOutputRatio}
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
                contentRef={contentRef}
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
        {explodeEnabled ? 'Click the text to explode it · ' : ''}Drag to move · drag corner handle
        to resize · text reflows · Esc to exit
      </div>
    </div>
  );
});
