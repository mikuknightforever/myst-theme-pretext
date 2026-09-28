import * as React from 'react';
import { contentScrollTop } from '../scroll-geometry.js';
import type { WordSpan } from '../layout.js';
import { EXPLODE_RADIUS, isBurstActive, type Burst } from '../effects/explode.js';
import { isIntroActive } from '../effects/intro.js';
import { isMotionActive, wordMotion } from '../effects/motion.js';

const NO_BURSTS: Burst[] = [];

const CANVAS_BUFFER = 600;

/** Viewport-aware canvas text renderer. */
export function WordCanvas({
  spans,
  width,
  scrollContainerRef,
  isDark,
  bursts = NO_BURSTS,
  introClock,
  introRunning = false,
}: {
  spans: WordSpan[];
  width: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  /** Active click-to-explode bursts; words near them are drawn displaced. */
  bursts?: Burst[];
  /** Milliseconds into the opening animation (null when it is not running),
   * advanced one frame at a time by the overlay. */
  introClock?: React.RefObject<number | null>;
  /** True until the opening animation has finished. */
  introRunning?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // Scroll position in layout coordinates; the canvas sits in the content element.
  const viewTop = React.useCallback(() => {
    const container = scrollContainerRef.current;
    return container ? contentScrollTop(container, canvasRef.current?.parentElement) : 0;
  }, [scrollContainerRef]);

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
      const introElapsed = introClock?.current ?? null;
      const intro = isIntroActive(introElapsed);
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
        if (!nearBurst && !intro) {
          ctx.fillText(s.text, s.x, baseline);
          continue;
        }
        const halfWidth = ctx.measureText(s.text).width / 2;
        const cx = s.x + halfWidth;
        const cy = s.y + s.style.lineHeight / 2;
        const offset = wordMotion(cx, cy, index, active, introElapsed, now);
        if (!offset) {
          ctx.fillText(s.text, s.x, baseline);
          continue;
        }
        // Rotate around the word's centre, then draw it at its displaced position.
        const centreY = cy - canvasTop;
        ctx.save();
        ctx.globalAlpha = offset.alpha;
        ctx.translate(cx + offset.dx, centreY + offset.dy);
        ctx.rotate(offset.rotation);
        ctx.fillText(s.text, -halfWidth, baseline - centreY);
        ctx.restore();
      }
    },
    [spans, width, scrollContainerRef, isDark, bursts, introClock, introRunning],
  );

  // Animate only while a burst is in flight, then draw the settled text once.
  React.useEffect(() => {
    if (bursts.length === 0 && !introRunning) return;
    let frame = 0;
    const tick = () => {
      const now = performance.now();
      draw(viewTop(), now);
      if (introRunning || isMotionActive(bursts, null, now)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bursts, introRunning, draw, viewTop]);

  React.useEffect(() => {
    draw(viewTop());
  }, [draw, viewTop]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        draw(viewTop());
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [draw, viewTop]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', left: 0, width, pointerEvents: 'none' }}
    />
  );
}
