import * as React from 'react';
import type { WordSpan } from '../layout.js';
import { combinedOffset, EXPLODE_RADIUS, isBurstActive, type Burst } from '../effects/explode.js';

const NO_BURSTS: Burst[] = [];

const CANVAS_BUFFER = 600;

/** Viewport-aware canvas text renderer. */
export function WordCanvas({
  spans,
  width,
  scrollContainerRef,
  isDark,
  bursts = NO_BURSTS,
}: {
  spans: WordSpan[];
  width: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  /** Active click-to-explode bursts; words near them are drawn displaced. */
  bursts?: Burst[];
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const draw = React.useCallback(
    (scrollTop: number, now = typeof performance === 'undefined' ? 0 : performance.now()) => {
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

      const active = bursts.filter((burst) => isBurstActive(burst, now));
      for (let index = 0; index < spans.length; index++) {
        const s = spans[index];
        if (s.code || s.math || s.semanticNode || s.maxWidth != null) continue;
        if (s.y < yMin || s.y > yMax) continue;
        const italic = s.italic ? 'italic ' : '';
        const weight = s.bold ? '700' : s.style.fontWeight;
        ctx.font = `${italic}${weight} ${s.style.fontSize}px ${s.style.fontFamily}`;
        ctx.fillStyle = isDark ? '#e5e7eb' : s.style.color;
        const halfLeading = Math.max(0, (s.style.lineHeight - s.style.fontSize) / 2);
        const baseline = s.y - canvasTop + halfLeading + s.style.fontSize * 0.82;
        const nearBurst =
          active.length > 0 &&
          active.some(
            (burst) =>
              Math.abs(burst.x - s.x) < EXPLODE_RADIUS + 400 &&
              Math.abs(burst.y - s.y) < EXPLODE_RADIUS + s.style.lineHeight,
          );
        if (!nearBurst) {
          ctx.fillText(s.text, s.x, baseline);
          continue;
        }
        const halfWidth = ctx.measureText(s.text).width / 2;
        const cx = s.x + halfWidth;
        const cy = s.y + s.style.lineHeight / 2;
        const offset = combinedOffset(cx, cy, index, active, now);
        if (!offset) {
          ctx.fillText(s.text, s.x, baseline);
          continue;
        }
        // Rotate around the word's centre, then draw it at its displaced position.
        const centreY = cy - canvasTop;
        ctx.save();
        ctx.translate(cx + offset.dx, centreY + offset.dy);
        ctx.rotate(offset.rotation);
        ctx.fillText(s.text, -halfWidth, baseline - centreY);
        ctx.restore();
      }
    },
    [spans, width, scrollContainerRef, isDark, bursts],
  );

  // Animate only while a burst is in flight, then draw the settled text once.
  React.useEffect(() => {
    if (bursts.length === 0) return;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      draw(scrollContainerRef.current?.scrollTop ?? 0, now);
      if (bursts.some((burst) => isBurstActive(burst, now))) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bursts, draw, scrollContainerRef]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    draw(container?.scrollTop ?? 0);
  }, [draw, scrollContainerRef]);

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
