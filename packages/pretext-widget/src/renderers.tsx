import * as React from 'react';
import { createPortal } from 'react-dom';
import { useReferences, useThemeSwitcher } from '@myst-theme/providers';
import { MyST } from 'myst-to-react';
import type { PretextWidget } from './types.js';
import { ColumnSelector } from './ColumnSelector.js';
import {
  layoutBlocksInColumns,
  type ColumnCount,
  type ColumnLayoutOptions,
} from './column-layout.js';
import {
  collectBlocks,
  findAllDraggableNodes,
  findImageUrl,
  layoutBlocks,
  DEFAULT_TEXT_STYLE,
} from './layout.js';
import type {
  WordSpan,
  ObstacleRect,
  ContentBlock,
  PlacedRichBlock,
  HeadingAnchor,
  LayoutResult,
} from './layout.js';

const FIGURE_WIDTH_DEFAULT = 280;
const FIGURE_HEIGHT_DEFAULT = 220;
const FIGURE_MIN_W = 120;
const FIGURE_MIN_H = 80;
const FIGURE_INLINE_MAX_W = 820;
const FIGURE_FALLBACK_ASPECT_RATIO = 1012 / 1800;
const FIGURE_CAPTION_ESTIMATE_H = 62;
const FIGURE_BLOCK_WIDTH_RATIO = 0.6;
const COLUMN_GAP = 32;
const COLUMN_MIN_WIDTH = 320;
const OVERLAY_PADDING = 40;

const PRETEXT_TEXT_STYLE = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 16,
  lineHeight: 26,
  paragraphGap: 20,
};

const EMPTY_LAYOUT: LayoutResult = {
  spans: [],
  richBlocks: [],
  figureAnchors: [],
  headingAnchors: [],
  contentBottom: 0,
};

/**
 * Cache only the small set of layouts needed to open a document. The blocks
 * array is stable for the lifetime of an article and can be held weakly, so
 * navigating away releases all cached spans automatically.
 */
const openingLayoutCache = new WeakMap<ContentBlock[], Map<string, LayoutResult>>();

function getOpeningLayout(
  blocks: ContentBlock[],
  key: string,
  calculate: () => LayoutResult,
): LayoutResult {
  let entries = openingLayoutCache.get(blocks);
  if (!entries) {
    entries = new Map();
    openingLayoutCache.set(blocks, entries);
  }
  const cached = entries.get(key);
  if (cached) return cached;
  const result = calculate();
  // Keep a few responsive widths without retaining an unbounded set.
  if (entries.size >= 4) {
    const oldest = entries.keys().next().value;
    if (oldest) entries.delete(oldest);
  }
  entries.set(key, result);
  return result;
}

interface FigureInfo {
  mdastNode: any;
  label: string;
  imageUrl: string | null;
}

interface FigurePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  inline: boolean;
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

function findFirstImageNode(node: any): any | null {
  if (!node) return null;
  if (node.type === 'image') return node;
  for (const child of node.children ?? []) {
    const found = findFirstImageNode(child);
    if (found) return found;
  }
  return null;
}

function parseDimension(value: unknown, relativeTo: number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const percent = trimmed.match(/^([0-9.]+)%$/);
  if (percent) return relativeTo * (Number(percent[1]) / 100);
  const pixels = trimmed.match(/^([0-9.]+)px$/);
  if (pixels) return Number(pixels[1]);
  const plain = Number(trimmed);
  return Number.isFinite(plain) ? plain : null;
}

function getFigureNaturalAspectRatio(fig: FigureInfo, loadedRatio?: number): number {
  if (loadedRatio && Number.isFinite(loadedRatio) && loadedRatio > 0) return loadedRatio;
  const imageNode = findFirstImageNode(fig.mdastNode);
  const naturalW = Number(imageNode?.width ?? imageNode?.naturalWidth ?? imageNode?.originalWidth);
  const naturalH = Number(imageNode?.height ?? imageNode?.naturalHeight ?? imageNode?.originalHeight);
  if (naturalW > 0 && naturalH > 0) return naturalH / naturalW;
  return FIGURE_FALLBACK_ASPECT_RATIO;
}

function getFigureDisplaySize(
  fig: FigureInfo,
  containerWidth: number,
  loadedRatio?: number,
): { width: number; height: number } {
  const articleLikeWidth = Math.max(FIGURE_MIN_W, Math.min(containerWidth, FIGURE_INLINE_MAX_W));
  const imageNode = findFirstImageNode(fig.mdastNode);
  const declaredWidth =
    parseDimension(fig.mdastNode?.width, articleLikeWidth) ??
    parseDimension(fig.mdastNode?.style?.width, articleLikeWidth) ??
    parseDimension(imageNode?.width, articleLikeWidth);
  const width = Math.round(
    Math.max(
      FIGURE_MIN_W,
      Math.min(containerWidth, declaredWidth ?? Math.min(articleLikeWidth, FIGURE_WIDTH_DEFAULT * 2.6)),
    ),
  );
  const declaredHeight =
    parseDimension(fig.mdastNode?.height, width) ??
    parseDimension(fig.mdastNode?.style?.height, width) ??
    parseDimension(imageNode?.height, width);
  const aspectRatio = getFigureNaturalAspectRatio(fig, loadedRatio);
  const imageHeight = declaredHeight ?? Math.round(width * aspectRatio);
  const hasCaption = (fig.mdastNode?.children ?? []).some((child: any) => child.type === 'caption');
  const height = Math.round(
    Math.max(FIGURE_MIN_H, imageHeight + (hasCaption ? FIGURE_CAPTION_ESTIMATE_H : 18)),
  );
  return { width, height };
}

function toObstacleRects(positions: FigurePosition[], containerWidth: number): ObstacleRect[] {
  return positions.map((position, figureIndex) => {
    // A wide card leaves only narrow gutters on either side. Treating those
    // gutters as usable line segments produces text that appears to run under
    // the figure/caption. Wide figures therefore remain block-level obstacles
    // even after the user starts dragging them; smaller cards still get true
    // text wrapping.
    const blocksFullLine =
      position.inline || position.width >= containerWidth * FIGURE_BLOCK_WIDTH_RATIO;
    return {
      left: blocksFullLine ? 0 : position.x,
      top: position.y,
      right: blocksFullLine ? containerWidth : position.x + position.width,
      bottom: position.y + position.height,
      figureIndex,
      inline: position.inline,
    };
  });
}

function buildInitialFigurePositions(
  blocks: ContentBlock[],
  figures: FigureInfo[],
  containerWidth: number,
  imageRatios: Record<number, number>,
  columnOptions: ColumnLayoutOptions,
): FigurePosition[] {
  const sizes = figures.map((fig, index) =>
    getFigureDisplaySize(fig, containerWidth, imageRatios[index]),
  );
  // Only the figure heights are needed to calculate a native document flow.
  // Keeping every sizing obstacle at y=0 avoids using stale pre-layout
  // coordinates while layoutBlocks reserves each height at its own anchor.
  const sizingObstacles: ObstacleRect[] = sizes.map((size, figureIndex) => ({
    left: 0,
    top: 0,
    right: containerWidth,
    bottom: size.height,
    figureIndex,
    inline: true,
  }));
  const dimensionKey = sizes.map((size) => `${size.width}x${size.height}`).join(';');
  const anchors = getOpeningLayout(
    blocks,
    `native-flow:${Math.round(containerWidth)}:${columnOptions.count}:${columnOptions.gap}:${dimensionKey}`,
    () =>
      layoutBlocksInColumns(
        blocks,
        sizingObstacles,
        containerWidth,
        0,
        PRETEXT_TEXT_STYLE,
        columnOptions,
      ),
  ).figureAnchors;
  return figures.map((_, i) => ({
    x: Math.max(0, Math.round((containerWidth - sizes[i].width) / 2)),
    y: anchors[i]?.y ?? 40 + i * (sizes[i].height + 32),
    width: sizes[i].width,
    height: sizes[i].height,
    inline: true,
  }));
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) {
        const next = Math.round(w);
        setWidth((current) => (current === next ? current : next));
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return width;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';

/** Debounce a value — only updates after `delay` ms of no changes. */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

const CANVAS_BUFFER = 600; // px above/below viewport to pre-render

/**
 * Viewport-aware canvas text renderer.
 *
 * The canvas is always viewport-height + 2×BUFFER tall (never megabytes of memory).
 * It repositions and redraws as the user scrolls, without touching React state.
 */
function WordCanvas({
  spans,
  width,
  scrollContainerRef,
  isDark,
}: {
  spans: WordSpan[];
  width: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const draw = React.useCallback(
    (scrollTop: number) => {
      const canvas = canvasRef.current;
      const container = scrollContainerRef.current;
      if (!canvas || !container || width <= 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewH = container.clientHeight;
      const canvasH = viewH + 2 * CANVAS_BUFFER;
      const canvasTop = Math.max(0, scrollTop - CANVAS_BUFFER);
      const yMin = canvasTop;
      const yMax = canvasTop + canvasH;

      const dpr = window.devicePixelRatio || 1;
      // Only reallocate if dimensions changed to avoid costly memory ops
      const needW = Math.round(width * dpr);
      const needH = Math.round(canvasH * dpr);
      if (canvas.width !== needW || canvas.height !== needH) {
        canvas.width = needW;
        canvas.height = needH;
      }
      canvas.style.top = `${canvasTop}px`;
      canvas.style.height = `${canvasH}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, canvasH);

      for (const s of spans) {
        if (s.code || s.math || s.semanticNode) continue;
        if (s.y < yMin || s.y > yMax) continue;
        const italic = s.italic ? 'italic ' : '';
        const weight = s.bold ? '700' : s.style.fontWeight;
        ctx.font = `${italic}${weight} ${s.style.fontSize}px ${s.style.fontFamily}`;
        ctx.fillStyle = isDark ? '#e5e7eb' : s.style.color;
        // Match the browser's inline-text baseline: half of the line-height
        // leading sits above the glyph box. DOM-rendered citations, links and
        // abbreviations use this baseline, so the canvas text must as well.
        const halfLeading = Math.max(0, (s.style.lineHeight - s.style.fontSize) / 2);
        ctx.fillText(
          s.text,
          s.x,
          (s.y - canvasTop) + halfLeading + s.style.fontSize * 0.82,
        );
      }
    },
    [spans, width, scrollContainerRef, isDark],
  );

  // Redraw when spans or width change
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    draw(container?.scrollTop ?? 0);
  }, [draw, scrollContainerRef]);

  // Scroll listener — redraws without React re-renders
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        draw(container.scrollTop);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [draw, scrollContainerRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', left: 0, width, pointerEvents: 'none' }}
    />
  );
}

const VIEWPORT_BUFFER = 500; // px above/below viewport to keep rendered

/** DOM layer for code, math, links, citations and cross references. */
function MathCodeLayer({
  spans,
  scrollContainerRef,
  isDark,
}: {
  spans: WordSpan[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  const viewH = scrollContainerRef.current?.clientHeight ?? 600;
  const yMin = scrollTop - VIEWPORT_BUFFER;
  const yMax = scrollTop + viewH + VIEWPORT_BUFFER;

  // Keep original index as key so React reuses DOM nodes when viewport shifts
  const visible = React.useMemo(() => {
    const out: Array<{ s: WordSpan; idx: number }> = [];
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      if ((s.code || s.math || s.semanticNode) && s.y >= yMin && s.y <= yMax) {
        out.push({ s, idx: i });
      }
    }
    return out;
  }, [spans, yMin, yMax]);

  if (visible.length === 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {visible.map(({ s, idx }) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            fontSize: s.style.fontSize,
            lineHeight: `${s.style.lineHeight}px`,
            fontFamily: s.code ? CODE_FONT : s.style.fontFamily,
            fontWeight: s.bold ? '700' : s.style.fontWeight,
            fontStyle: s.italic ? 'italic' : 'normal',
            color: isDark ? '#e5e7eb' : s.style.color,
            whiteSpace: 'nowrap',
            pointerEvents: s.semanticNode ? 'auto' : 'none',
            ...(s.code && {
              background: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)',
              borderRadius: 3,
              padding: '1px 3px',
            }),
          }}
        >
          {s.semanticNode ? (
            <MyST ast={[s.semanticNode]} />
          ) : s.math && s.mathHtml ? (
            <span dangerouslySetInnerHTML={{ __html: s.mathHtml }} />
          ) : (
            s.text
          )}
        </span>
      ))}
    </div>
  );
}

function PretextOutline({
  headings,
  scrollContainerRef,
  isDark,
}: {
  headings: HeadingAnchor[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const [activeId, setActiveId] = React.useState(headings[0]?.id ?? '');

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const marker = container.scrollTop + 120;
      let next = headings[0].id;
      for (const heading of headings) {
        if (heading.y > marker) break;
        next = heading.id;
      }
      setActiveId((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(update);
    };
    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [headings, scrollContainerRef]);

  if (headings.length === 0) return null;
  const minDepth = Math.min(...headings.map((heading) => heading.depth));

  return (
    <nav aria-label="Pretext document outline">
      <div
        style={{
          marginBottom: 12,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isDark ? '#94a3b8' : '#64748b',
        }}
      >
        On this page
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id} style={{ margin: '2px 0' }}>
              <button
                type="button"
                aria-current={active ? 'location' : undefined}
                onClick={() => {
                  scrollContainerRef.current?.scrollTo({
                    top: Math.max(0, heading.y - 24),
                    behavior: 'smooth',
                  });
                }}
                style={{
                  width: '100%',
                  border: 0,
                  borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
                  borderRadius: '0 7px 7px 0',
                  padding: `7px 8px 7px ${8 + (heading.depth - minDepth) * 12}px`,
                  background: active
                    ? isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.09)'
                    : 'transparent',
                  color: active ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#cbd5e1' : '#475569'),
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  lineHeight: 1.35,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {heading.title}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Memoized single equation — prevents re-render when only y-position changes. */
const MemoEquation = React.memo(function MemoEquation({ node }: { node: any }) {
  return <MyST ast={[node]} />;
});

/** Memoized iframe panel — renders the <iframe> directly to control height precisely. */
const MemoIframe = React.memo(function MemoIframe({
  src,
  iframeHeight,
  captionChildren,
}: {
  src: string;
  iframeHeight: number;
  captionChildren: any[];
}) {
  return (
    <div style={{ padding: '8px 0 16px' }}>
      <iframe
        src={src}
        style={{
          width: '100%',
          height: iframeHeight,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 6,
          display: 'block',
        }}
        title=""
      />
      {captionChildren.length > 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#64748b', paddingTop: 8 }}>
          <MyST ast={captionChildren} />
        </div>
      )}
    </div>
  );
});

/** Block math layer — viewport-culled, equations themselves memoized. */
function RichBlockLayer({
  richBlocks,
  scrollContainerRef,
}: {
  richBlocks: PlacedRichBlock[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  const viewH = scrollContainerRef.current?.clientHeight ?? 600;
  const yMin = scrollTop - VIEWPORT_BUFFER;
  const yMax = scrollTop + viewH + VIEWPORT_BUFFER;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {richBlocks.map((block, i) => {
        const isIframe =
          block.node?.type === 'iframe' ||
          (block.node?.children ?? []).some((c: any) => c.type === 'iframe');
        // Iframes: always keep mounted (no culling) — avoids reload on scroll
        if (!isIframe && (block.y + block.estimatedHeight < yMin || block.y > yMax)) return null;

        // Iframes: render directly (bypasses MyST container margins that cause text overlap)
        if (isIframe) {
          const iframeNode =
            block.node?.type === 'iframe'
              ? block.node
              : (block.node?.children ?? []).find((c: any) => c.type === 'iframe') ?? block.node;
          const captionNode =
            block.node?.type === 'container'
              ? (block.node.children ?? []).find((c: any) => c.type === 'caption')
              : null;
          const ih =
            typeof iframeNode.height === 'number'
              ? iframeNode.height
              : parseInt(String(iframeNode.height ?? '400')) || 400;
          const src = iframeNode.src ?? iframeNode.url ?? iframeNode.value ?? '';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: block.y,
                width: '100%',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
              }}
            >
              <MemoIframe src={src} iframeHeight={ih} captionChildren={captionNode?.children ?? []} />
            </div>
          );
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: block.y,
              width: '100%',
              boxSizing: 'border-box',
              minHeight: block.estimatedHeight,
            }}
          >
            <MemoEquation node={block.node} />
          </div>
        );
      })}
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
              color: isDark ? '#cbd5e1' : '#475569',
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
  blocks: ContentBlock[];
  figures: FigureInfo[];
  onClose: () => void;
}

const PretextOverlay = React.memo(function PretextOverlay({ blocks, figures, onClose }: OverlayProps) {
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

  const [figureLayout, setFigureLayout] = React.useState<{
    width: number;
    columns: ColumnCount;
    positions: FigurePosition[];
  } | null>(null);
  const [imageRatios, setImageRatios] = React.useState<Record<number, number>>({});
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
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const missing = figures
      .map((fig, index) => ({ fig, index }))
      .filter(({ fig, index }) => fig.imageUrl && !imageRatios[index]);
    if (missing.length === 0) return undefined;

    Promise.all(
      missing.map(
        ({ fig, index }) =>
          new Promise<{ index: number; ratio: number | null }>((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                resolve({ index, ratio: null });
                return;
              }
              resolve({ index, ratio: img.naturalHeight / img.naturalWidth });
            };
            img.onerror = () => resolve({ index, ratio: null });
            img.src = fig.imageUrl as string;
          }),
      ),
    ).then((loaded) => {
      if (cancelled) return;
      setImageRatios((current) => {
        let changed = false;
        const next = { ...current };
        for (const { index, ratio } of loaded) {
          if (!ratio || current[index] === ratio) continue;
          next[index] = ratio;
          changed = true;
        }
        return changed ? next : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [figures, imageRatios]);

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

  const positionKey = figPositions
    ?.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.width)},${Math.round(p.height)},${p.inline ? 1 : 0}`)
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
      <header
        style={{
          height: 68,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          borderBottom: '1px solid rgba(148,163,184,0.3)',
          background: isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(12px)',
          boxSizing: 'border-box',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
            Pretext Mode
          </div>
          <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
            {figures.length} draggable figure{figures.length !== 1 ? 's' : ''} · rendered via MyST
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ColumnSelector
            value={columnCount}
            maxColumns={maxColumnCount}
            onChange={changeColumnCount}
            isDark={isDark}
          />
          <button
            type="button"
            onClick={nextTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 42,
              height: 42,
              border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
              borderRadius: 999,
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f8fafc' : '#111827',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
          </button>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${isDark ? 'rgba(226,232,240,0.32)' : 'rgba(15,23,42,0.2)'}`,
              borderRadius: 999,
              padding: '10px 16px',
              background: isDark ? '#f8fafc' : '#111827',
              color: isDark ? '#0f172a' : '#fff',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Exit Pretext Mode
          </button>
        </div>
      </header>

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

            {figPositions && figures.map((fig, i) => (
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

export function PretextWidgetRenderer({ node }: { node: PretextWidget }) {
  const references = useReferences();
  const { isDark } = useThemeSwitcher();
  const [open, setOpen] = React.useState(false);
  const onClose = React.useCallback(() => setOpen(false), []);

  const draggableSelector = node.draggableSelector ?? 'pretext-draggable';

  const { blocks, figures } = React.useMemo(() => {
    const mdast = (references as any)?.article;
    if (!mdast) return { blocks: [], figures: [] };

    const blks = collectBlocks(mdast);
    const figNodes = findAllDraggableNodes(mdast, draggableSelector);

    const figs: FigureInfo[] = figNodes.map((figNode, i) => ({
      mdastNode: figNode,
      label: `Figure ${i + 1}`,
      imageUrl: findImageUrl(figNode),
    }));

    return { blocks: blks, figures: figs };
  }, [references, draggableSelector]);

  return (
    <>
      <section
        style={{
          margin: '1.5rem 0',
          padding: '18px 20px',
          borderRadius: 18,
          border: `1px solid ${isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.28)'}`,
          background: isDark ? 'rgba(30,41,59,0.92)' : 'rgba(248,250,252,0.92)',
          fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 18,
            fontWeight: 800,
            color: isDark ? '#f8fafc' : '#111827',
          }}
        >
          Pretext Mode
        </p>
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            lineHeight: 1.6,
            color: isDark ? '#cbd5e1' : '#475569',
          }}
        >
          {figures.length > 0
            ? `Found ${figures.length} draggable figure${figures.length !== 1 ? 's' : ''}. Open Pretext Mode to drag them — text reflows around all figures simultaneously.`
            : 'Open Pretext Mode to see this article with draggable figures.'}
        </p>
        {blocks.length === 0 && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
            (No article content found in MDAST.)
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            border: `1px solid ${isDark ? 'rgba(226,232,240,0.3)' : 'rgba(15,23,42,0.18)'}`,
            borderRadius: 999,
            padding: '10px 16px',
            background: isDark ? '#f8fafc' : '#111827',
            color: isDark ? '#0f172a' : '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Open Pretext Mode
        </button>
      </section>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <PretextOverlay
              blocks={blocks}
              figures={figures}
              onClose={onClose}
            />,
            document.body,
          )
        : null}
    </>
  );
}
