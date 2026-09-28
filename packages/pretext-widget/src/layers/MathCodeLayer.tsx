import * as React from 'react';
import { contentScrollTop } from '../scroll-geometry.js';
import { MyST } from 'myst-to-react';
import {
  inlineMeasurementKey,
  styleForBlock,
  type ContentBlock,
  type InlineMetrics,
  type StyledWord,
  type TextStyle,
  type WordSpan,
} from '../layout.js';
import { applyExplodeTransforms, type Burst } from '../effects/explode.js';
import { wordMotion } from '../effects/motion.js';

const NO_BURSTS: Burst[] = [];

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';
const VIEWPORT_BUFFER = 500;

function inlineStyle(word: StyledWord | WordSpan, style: TextStyle): React.CSSProperties {
  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight + 'px',
    fontFamily: word.code ? CODE_FONT : style.fontFamily,
    fontWeight: word.bold ? '700' : style.fontWeight,
    fontStyle: word.italic ? 'italic' : 'normal',
    whiteSpace: 'nowrap',
    ...(word.code && { padding: '1px 3px', borderRadius: 3 }),
  };
}

const InlineContent = React.memo(function InlineContent({ word }: { word: StyledWord | WordSpan }) {
  if (word.semanticNode) return <MyST ast={[word.semanticNode]} />;
  if (word.math && word.mathHtml)
    return <span dangerouslySetInnerHTML={{ __html: word.mathHtml }} />;
  return <>{word.text}</>;
});

/** Measure unique DOM tokens throughout the article. Scrolling must not
 * discover different dimensions and shift later figures. Visible tokens stay
 * virtualized; one observer batches measurements of their intrinsic copies. */
export const InlineMeasurementLayer = React.memo(function InlineMeasurementLayer({
  blocks,
  textStyle,
  onMetricsChange,
}: {
  blocks: ContentBlock[];
  textStyle: TextStyle;
  onMetricsChange: (metrics: Record<string, InlineMetrics>) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const tokens = React.useMemo(() => {
    const unique = new Map<string, { key: string; word: StyledWord; style: TextStyle }>();
    for (const block of blocks) {
      if (!('words' in block)) continue;
      const style = styleForBlock(block, textStyle);
      for (const word of block.words) {
        if (!word.math && !word.code && !word.semanticNode) continue;
        const key = inlineMeasurementKey(word, style);
        unique.set(key, { key, word, style });
      }
    }
    return [...unique.values()];
  }, [blocks, textStyle]);

  React.useLayoutEffect(() => {
    const elements = Array.from(ref.current?.children ?? []) as HTMLElement[];
    let frame = 0;
    let cancelled = false;
    const report = () => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const metrics: Record<string, InlineMetrics> = {};
        elements.forEach((element, i) => {
          const rect = element.getBoundingClientRect();
          metrics[tokens[i].key] = {
            width: Math.ceil(Math.max(rect.width, element.scrollWidth)),
            height: Math.ceil(Math.max(rect.height, element.scrollHeight)),
          };
        });
        onMetricsChange(metrics);
      });
    };
    const observer = new ResizeObserver(report);
    elements.forEach((element) => {
      observer.observe(element);
    });
    report();
    void document.fonts?.ready.then(report);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [tokens, onMetricsChange]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pretext-inline-measurements"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {tokens.map(({ key, word, style }) => (
        <span
          key={key}
          style={{
            ...inlineStyle(word, style),
            position: 'absolute',
            display: 'inline-block',
            width: 'max-content',
          }}
        >
          <InlineContent word={word} />
        </span>
      ))}
    </div>
  );
});

/** DOM layer for code, math, links, citations and cross references. */
export function MathCodeLayer({
  spans,
  scrollContainerRef,
  isDark,
  bursts = NO_BURSTS,
  introClock,
  introRunning = false,
}: {
  spans: WordSpan[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  /** Active click-to-explode bursts; tokens near them fly with the canvas words. */
  bursts?: Burst[];
  /** Milliseconds into the opening animation (null when it is not running),
   * advanced one frame at a time by the overlay. */
  introClock?: React.RefObject<number | null>;
  /** True until the opening animation has finished. */
  introRunning?: boolean;
}) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  // Transforms are written straight to the elements each frame; React never
  // sets `transform` here, so re-renders while scrolling leave them alone. A
  // layout effect applies the current motion before the browser paints, so
  // re-rendered tokens never flash in their final place mid-animation.
  const animating = bursts.length > 0 || introRunning;
  React.useLayoutEffect(() => {
    if (!animating) return;
    let frame = 0;
    const apply = () => {
      const elements = layerRef.current?.querySelectorAll<HTMLElement>('[data-pretext-inline]');
      const now = performance.now();
      return applyExplodeTransforms(elements ?? [], spans, bursts, now, (cx, cy, index) =>
        wordMotion(cx, cy, index, bursts, introClock?.current ?? null, now),
      );
    };
    const tick = () => {
      if (apply() || introRunning) frame = requestAnimationFrame(tick);
    };
    apply();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animating, bursts, introRunning, introClock, spans]);
  // Clear leftover styles only once every effect has finished.
  React.useLayoutEffect(() => {
    if (animating) return;
    layerRef.current?.querySelectorAll<HTMLElement>('[data-pretext-inline]').forEach((element) => {
      element.style.transform = '';
      element.style.opacity = '';
    });
  }, [animating, spans]);
  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(contentScrollTop(el, layerRef.current?.parentElement));
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);
  const yMin = scrollTop - VIEWPORT_BUFFER;
  const yMax = scrollTop + (scrollContainerRef.current?.clientHeight ?? 600) + VIEWPORT_BUFFER;
  return (
    <div ref={layerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {spans.map((span, index) => {
        if (
          !(span.code || span.math || span.semanticNode || span.maxWidth != null) ||
          span.y + (span.height ?? span.style.lineHeight) < yMin ||
          span.y > yMax
        )
          return null;
        return (
          <span
            key={index}
            data-pretext-inline={index}
            style={{
              ...inlineStyle(span, span.style),
              position: 'absolute',
              left: span.x,
              top: span.y,
              display: 'inline-block',
              color: isDark ? '#e5e7eb' : span.style.color,
              pointerEvents: span.semanticNode || span.maxWidth != null ? 'auto' : 'none',
              ...(span.code && {
                background: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)',
              }),
              ...(span.maxWidth != null && {
                maxWidth: span.maxWidth,
                boxSizing: 'border-box',
                overflowX: 'auto',
                overflowY: 'hidden',
                overscrollBehaviorX: 'contain',
                touchAction: 'pan-x',
              }),
            }}
          >
            <InlineContent word={span} />
          </span>
        );
      })}
    </div>
  );
}
