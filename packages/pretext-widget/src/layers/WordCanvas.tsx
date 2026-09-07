import * as React from 'react';
import type { WordSpan } from '../layout.js';

const CANVAS_BUFFER = 600;

/** Viewport-aware canvas text renderer. */
export function WordCanvas({
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
        if (s.code || s.math || s.semanticNode || s.maxWidth != null) continue;
        if (s.y < yMin || s.y > yMax) continue;
        const italic = s.italic ? 'italic ' : '';
        const weight = s.bold ? '700' : s.style.fontWeight;
        ctx.font = `${italic}${weight} ${s.style.fontSize}px ${s.style.fontFamily}`;
        ctx.fillStyle = isDark ? '#e5e7eb' : s.style.color;
        const halfLeading = Math.max(0, (s.style.lineHeight - s.style.fontSize) / 2);
        ctx.fillText(s.text, s.x, s.y - canvasTop + halfLeading + s.style.fontSize * 0.82);
      }
    },
    [spans, width, scrollContainerRef, isDark],
  );

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
