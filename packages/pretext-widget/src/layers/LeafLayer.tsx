import * as React from 'react';
import type { EffectsEngine } from '../effects/engine.js';
import { LEAF_SHAPES, LOGO_BODY, LOGO_BOX } from '../effects/leaf-shapes.js';
import { SHIP_SIZE } from '../effects/leaves.js';
import { contentScrollTop } from '../scroll-geometry.js';
import { DARK } from '../components/palette.js';

/** Draws the floating logo and its leaves over the visible text (leaves effect). */
export function LeafLayer({
  engine,
  width,
  scrollContainerRef,
  isDark,
}: {
  engine: EffectsEngine;
  width: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const paths = React.useMemo(
    () => (typeof Path2D === 'undefined' ? [] : LEAF_SHAPES.map((shape) => new Path2D(shape.path))),
    [],
  );
  const bodyPaths = React.useMemo(
    () => (typeof Path2D === 'undefined' ? [] : LOGO_BODY.map((part) => new Path2D(part.path))),
    [],
  );
  const drewLeaves = React.useRef(false);

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const scroll = scrollContainerRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !scroll || !ctx || width <= 0) return;
    const field = engine.leafField;
    const leaves = field.leaves;
    const centre = field.shipCentre();
    if (!leaves.length && !centre && !drewLeaves.current) return;
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
    if (centre && paths.length) {
      // The logo in its own coordinates, in the SVG's paint order: the patches,
      // the green leaf, the letter, then the other two leaves.
      const [lx, ly, lw, lh] = LOGO_BOX;
      const scale = (SHIP_SIZE / Math.max(lw, lh)) * field.shipPulse();
      const growth = field.shipGrowth();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(centre.x, centre.y - top);
      ctx.rotate(field.shipTilt());
      ctx.scale(scale, scale);
      ctx.translate(-(lx + lw / 2), -(ly + lh / 2));
      const leafOnLogo = (index: number) => {
        if (growth <= 0) return;
        const [bx, by, bw, bh] = LEAF_SHAPES[index].box;
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        ctx.save();
        ctx.globalAlpha = growth;
        ctx.translate(cx, cy);
        ctx.scale(growth, growth);
        ctx.translate(-cx, -cy);
        ctx.fillStyle = LEAF_SHAPES[index].color;
        ctx.fill(paths[index]);
        ctx.restore();
      };
      const body = (index: number) => {
        // The dark letter would disappear on a dark page, so it turns light.
        const part = LOGO_BODY[index];
        ctx.fillStyle = isDark && part.id === 'letter-e' ? DARK.textStrong : part.color;
        ctx.fill(bodyPaths[index]);
      };
      body(0);
      body(1);
      leafOnLogo(0);
      body(2);
      leafOnLogo(1);
      leafOnLogo(2);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drewLeaves.current = leaves.length > 0 || centre != null;
  }, [engine, paths, bodyPaths, scrollContainerRef, width, isDark]);

  React.useEffect(() => engine.subscribe(draw), [engine, draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', left: 0, width, pointerEvents: 'none', zIndex: 40 }}
    />
  );
}
