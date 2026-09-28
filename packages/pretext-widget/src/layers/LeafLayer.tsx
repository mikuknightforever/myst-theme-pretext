import * as React from 'react';
import type { EffectsEngine } from '../effects/engine.js';
import { LEAF_SHAPES } from '../effects/leaf-shapes.js';
import { contentScrollTop } from '../scroll-geometry.js';

/** Draws the falling logo leaves over the visible text (leaves effect). */
export function LeafLayer({
  engine,
  width,
  scrollContainerRef,
}: {
  engine: EffectsEngine;
  width: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const paths = React.useMemo(
    () => (typeof Path2D === 'undefined' ? [] : LEAF_SHAPES.map((shape) => new Path2D(shape.path))),
    [],
  );
  const drewLeaves = React.useRef(false);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const scroll = scrollContainerRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !scroll || !ctx || width <= 0) return;
    const leaves = engine.leafField.leaves;
    if (!leaves.length && !drewLeaves.current) return;
    const top = Math.max(0, contentScrollTop(scroll, canvas.parentElement));
    const height = scroll.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    canvas.style.top = `${top}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const leaf of leaves) {
      const shape = LEAF_SHAPES[leaf.shape];
      const [bx, by, bw, bh] = shape.box;
      const scale = leaf.size / Math.max(bw, bh);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(leaf.x, leaf.y - top);
      ctx.rotate(leaf.rotation);
      ctx.scale(scale, scale);
      ctx.translate(-(bx + bw / 2), -(by + bh / 2));
      ctx.fillStyle = shape.color;
      ctx.fill(paths[leaf.shape]);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drewLeaves.current = leaves.length > 0;
  }, [engine, paths, scrollContainerRef, width]);

  React.useEffect(() => engine.subscribe(draw), [engine, draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, width, pointerEvents: 'none', zIndex: 40 }}
    />
  );
}
