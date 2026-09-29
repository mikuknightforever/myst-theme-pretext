import * as React from 'react';
import { DARK } from './palette.js';
import { useThemeSwitcher } from '@myst-theme/providers';
import type { ColumnCount } from '../column-layout.js';
import { COLUMN_GAP, COLUMN_MIN_WIDTH, COLUMN_PAGE_GAP, OVERLAY_PADDING } from '../config.js';
import { FigureCard } from '../figures/FigureCard.js';
import { EffectsEngine, WAVE_MS, type EffectMode } from '../effects/engine.js';
import { useOutlineHidden } from '../outline-preference.js';
import { useStoredFlag, WELCOME_SEEN_KEY } from '../preferences.js';
import { WelcomeCard } from './WelcomeCard.js';
import { contentScrollTop } from '../scroll-geometry.js';
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
import { LeafLayer } from '../layers/LeafLayer.js';
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
  // One engine and one animation loop for every text effect; the loop only runs
  // while something moves, and the layers redraw from the engine each frame.
  const engine = React.useMemo(() => new EffectsEngine(), []);
  // Scatter is on by default: move the cursor quickly across the words.
  const [effectMode, setEffectMode] = React.useState<EffectMode>('leaves');
  const [welcomeSeen, setWelcomeSeen] = useStoredFlag(WELCOME_SEEN_KEY);
  const activeMode: EffectMode = reduceMotion ? 'none' : effectMode;
  engine.mode = activeMode;
  const loopRef = React.useRef(0);
  const burstSeed = React.useRef(1);
  const ensureLoop = React.useCallback(() => {
    if (loopRef.current) return;
    const tick = (time: number) => {
      const scroll = scrollRef.current;
      if (scroll) {
        engine.setView(
          contentScrollTop(scroll, contentRef.current),
          scroll.clientHeight,
          contentRef.current?.clientWidth,
        );
      }
      engine.beginFrame(time);
      engine.notify();
      loopRef.current = engine.isActive(time) ? requestAnimationFrame(tick) : 0;
      // One last frame draws everything back in place.
      if (!loopRef.current) engine.notify();
    };
    loopRef.current = requestAnimationFrame(tick);
  }, [engine]);
  React.useEffect(() => () => cancelAnimationFrame(loopRef.current), []);
  React.useEffect(() => {
    if (activeMode !== 'scatter' && activeMode !== 'magnify') engine.pointerLeave();
    // The pointer cursor over the floating logo is set directly; clear it.
    if (activeMode !== 'leaves' && activeMode !== 'explode' && contentRef.current) {
      contentRef.current.style.cursor = '';
    }
    ensureLoop();
  }, [activeMode, engine, ensureLoop]);
  const contentPoint = (
    event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const trackPointer = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activeMode === 'leaves') {
        const { x, y } = contentPoint(event);
        event.currentTarget.style.cursor = engine.leafField.hitShip(x, y) ? 'pointer' : '';
        return;
      }
      if (activeMode !== 'scatter' && activeMode !== 'magnify') return;
      const { x, y } = contentPoint(event);
      engine.pointer(x, y);
      ensureLoop();
    },
    [activeMode, engine, ensureLoop],
  );
  const releasePointer = React.useCallback(() => engine.pointerLeave(), [engine]);
  const explodeAt = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Plain canvas text has no DOM of its own, so a click on it lands on the
      // content element itself; links, figures, math and code keep their clicks.
      if (activeMode !== 'explode' || event.target !== event.currentTarget) return;
      const { x, y } = contentPoint(event);
      engine.addBurst({ x, y, start: performance.now(), seed: burstSeed.current++ });
      ensureLoop();
    },
    [activeMode, engine, ensureLoop],
  );
  const [requestedColumnCount, setRequestedColumnCount] = React.useState<ColumnCount>(1);
  const maxColumnCount = Math.max(
    1,
    Math.min(
      4,
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
    basePositions,
    captionModes,
    toggleCaption,
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
  // Load wave: as soon as text is laid out, the words on screen do a Mexican
  // wave. Notebook charts in figure cards (Plotly: over a second of main-thread
  // work) mount only after it, so the wave runs on an idle page.
  const [outputsReady, setOutputsReady] = React.useState(reduceMotion);
  const waveStarted = React.useRef(false);
  React.useEffect(() => {
    if (outputsReady || !layoutReady || waveStarted.current) return;
    waveStarted.current = true;
    engine.startWave(performance.now());
    ensureLoop();
    const timer = setTimeout(() => setOutputsReady(true), WAVE_MS + 50);
    return () => clearTimeout(timer);
  }, [engine, ensureLoop, layoutReady, outputsReady]);
  const { draggingIdx, resizingIdx, startDrag, startResize, moveDrag, endDrag } =
    useFigureInteractions({
      figPositions: basePositions,
      setFigureLayout,
      containerWidth,
      columnCount,
      readingKey,
      heightForWidth,
    });
  React.useEffect(() => engine.setWords(spans), [engine, spans]);
  const { rememberReadingPosition, followLocalReference } = useReadingNavigation({
    headingAnchors,
    contentRef,
    scrollRef,
  });
  /** A click on the floating logo fires its leaves, even over a link. */
  const clickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (activeMode === 'leaves') {
        const { x, y } = contentPoint(event);
        if (engine.leafField.hitShip(x, y)) {
          event.preventDefault();
          event.stopPropagation();
          engine.leafField.fire(performance.now());
          return;
        }
      }
      followLocalReference(event);
    },
    [activeMode, engine, followLocalReference],
  );
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Esc first closes the welcome card, then the reader.
      if (!welcomeSeen) setWelcomeSeen(true);
      else onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, welcomeSeen, setWelcomeSeen]);
  function changeColumnCount(nextCount: ColumnCount) {
    rememberReadingPosition();
    // Words move from where they are now to their places in the new columns.
    if (!reduceMotion && nextCount !== columnCount) {
      const scroll = scrollRef.current;
      if (scroll) engine.setView(contentScrollTop(scroll, contentRef.current), scroll.clientHeight);
      engine.startTransition(spans, performance.now());
      ensureLoop();
    }
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
        background: isDark ? DARK.page : '#ffffff',
        color: isDark ? DARK.text : '#111827',
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
          /* The theme's header is laid out on the article page's grid, whose
             tracks are sized for the page. Here it fills Pretext's header box. */
          .pretext-article-header .myst-article-header,
          .pretext-article-header .myst-article-header-content,
          .pretext-article-header .myst-article-header-background {
            display: block;
          }
          /* The banner layer is positioned against the full-width header band,
             not the theme's own header, so it spans the reader like the page. */
          .pretext-article-header .myst-article-header {
            position: static;
          }
          .pretext-article-header .myst-article-header-background {
            inset: 0;
            width: auto;
            height: auto;
          }px;
            right: -${OVERLAY_PADDING}px;
            width: auto;
          }
          /* Card frame and move/resize controls appear gently on hover. */
          .pretext-figure-card {
            box-shadow: 0 0 0 1px transparent;
            transition: box-shadow 150ms ease;
          }
          .pretext-figure-card:hover,
          .pretext-figure-card[data-active] {
            box-shadow: 0 0 0 1.5px rgba(37,99,235,0.45), 0 8px 24px rgba(15,23,42,0.12);
          }
          .pretext-card-chrome {
            opacity: 0;
            transition: opacity 150ms ease;
          }
          .pretext-figure-card:hover .pretext-card-chrome,
          .pretext-figure-card[data-active] .pretext-card-chrome {
            opacity: 1;
          }
          @media (hover: none) {
            .pretext-card-chrome { opacity: 1; }
          }
          }
        `}
      </style>
      {!welcomeSeen && <WelcomeCard isDark={isDark} onClose={() => setWelcomeSeen(true)} />}
      {/* The theme switch stays where the article has it (top right), outside the toolbar. */}
      <button
        type="button"
        onClick={nextTheme}
        aria-label="Toggle theme between light and dark mode"
        title="Toggle theme between light and dark mode"
        style={{
          position: 'absolute',
          top: 16,
          // right-4 plus the theme button's own mx-3 margin in the article theme.
          right: 28,
          zIndex: 100,
          width: 40,
          height: 40,
          padding: '8px',
          borderRadius: 999,
          border: `1px solid ${isDark ? '#ffffff' : '#44403c'}`,
          background: isDark ? 'rgba(28,25,23,0.6)' : 'rgba(255,255,255,0.6)',
          color: isDark ? '#ffffff' : '#44403c',
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
          {isDark ? (
            <path
              d="M21.75 15A9.72 9.72 0 0 1 18 15.75 9.75 9.75 0 0 1 8.25 6c0-1.33.27-2.6.75-3.75A9.75 9.75 0 1 0 21.75 15Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          ) : (
            <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="3.75" />
              <path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.59 1.59M16.77 16.77l1.59 1.59M5.64 18.36l1.59-1.59M16.77 7.23l1.59-1.59" />
            </g>
          )}
        </svg>
      </button>
      <PretextToolbar
        figureCount={figures.length}
        columnCount={columnCount}
        maxColumnCount={maxColumnCount}
        isDark={isDark}
        readingSettings={readingSettings}
        onColumnChange={changeColumnCount}
        onReadingSettingsChange={changeReadingSettings}
        onReadingSettingsReset={restoreReadingSettings}
        outlineToggleAvailable={outlineFits}
        outlineHidden={outlineHidden}
        onOutlineToggle={toggleOutline}
        effectMode={activeMode}
        effectsAvailable={!reduceMotion}
        onEffectModeChange={setEffectMode}
        onClose={onClose}
      />

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          overscrollBehavior: 'contain',
          background: isDark ? DARK.page : '#ffffff',
          // The floating toolbar sits at the bottom; text scrolls underneath it.
          paddingBottom: TOOLBAR_CLEARANCE,
        }}
      >
        {header && (
          // Full-width band (the banner covers it, as on the article page), with
          // the card at the text's width inside.
          <div
            className="pretext-article-header"
            style={{
              // The overlay sets a reading font; the theme's header keeps the page's own.
              fontFamily: themeFont,
              position: 'relative',
              zIndex: 0,
              display: 'flow-root',
            }}
          >
            <div
              style={{
                maxWidth: readingSettings.readingWidth + (outlineFits ? 240 : 0),
                margin: '0 auto',
                padding: `0 ${24 + OVERLAY_PADDING}px`,
                boxSizing: 'border-box',
              }}
            >
              {header}
            </div>
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
            onClickCapture={clickCapture}
            onClick={explodeAt}
            onPointerMove={trackPointer}
            onPointerLeave={releasePointer}
            style={{
              position: 'relative',
              cursor: activeMode === 'explode' ? 'crosshair' : undefined,

              // Side insets are margins, not padding: the text layers are
              // absolutely positioned, and absolute children ignore padding, which
              // had shifted all text 40px left of centre.
              padding: `${OVERLAY_PADDING}px 0`,
              margin: `0 ${OVERLAY_PADDING}px`,
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
              engine={engine}
              contentHeight={contentHeight}
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
              engine={engine}
            />
            <LeafLayer
              engine={engine}
              width={containerWidth}
              scrollContainerRef={scrollRef}
              isDark={isDark}
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
                  captionMode={captionModes[i]}
                  deferOutput={!outputsReady}
                  onToggleCaption={toggleCaption}
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
                background: isDark ? DARK.panelTranslucent : 'rgba(248,250,252,0.82)',
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
    </div>
  );
});
