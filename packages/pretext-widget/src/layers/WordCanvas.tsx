import * as React from 'react';
import { contentScrollTop } from '../scroll-geometry.js';
import type { WordSpan } from '../layout.js';
import type { EffectsEngine } from '../effects/engine.js';
import { drawWords } from './draw-words.js';

const CANVAS_BUFFER = 600;

/** Viewport-aware canvas text renderer. */
export function WordCanvas({
  spans,
  width,
  scrollContainerRef,
  isDark,
  engine,
  contentHeight,
}: {
  spans: WordSpan[];
  width: number;
  /** Bottom of the content: the canvas never extends past it, or its drawing
   * buffer would add empty scrollable space at the end of the article. */
  contentHeight?: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  /** Text effects; each animation frame redraws with the engine's word motion. */
  engine?: EffectsEngine;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // Word widths for effect drawing, measured once per laid-out span.
  const widthCache = React.useRef(new WeakMap<WordSpan, number>());
  // Scroll position in layout coordinates; the canvas sits in the content element.
  const viewTop = React.useCallback(() => {
    const container = scrollContainerRef.current;
    return container ? contentScrollTop(container, canvasRef.current?.parentElement) : 0;
  }, [scrollContainerRef]);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const container = scrollContainerRef.current;
    if (!canvas || !container || width <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const viewH = container.clientHeight;
    const canvasTop = Math.max(0, viewTop() - CANVAS_BUFFER);
    const buffered = viewH + 2 * CANVAS_BUFFER;
    const canvasH = Math.max(
      1,
      contentHeight != null ? Math.min(buffered, contentHeight - canvasTop) : buffered,
    );

    const dpr = window.devicePixelRatio || 1;
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
    drawWords(ctx, spans, {
      canvasTop,
      yMin: canvasTop,
      yMax: canvasTop + canvasH,
      dpr,
      isDark,
      widthOf: (span) => {
        let measured = widthCache.current.get(span);
        if (measured === undefined) {
          measured = ctx.measureText(span.text).width;
          widthCache.current.set(span, measured);
        }
        return measured;
      },
      motionAt: engine?.anyMotion
        ? (index, cx, cy, span) => engine.motion(index, cx, cy, span)
        : null,
    });
  }, [spans, width, scrollContainerRef, isDark, engine, viewTop, contentHeight]);

  React.useEffect(() => engine?.subscribe(draw), [engine, draw]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        draw();
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
