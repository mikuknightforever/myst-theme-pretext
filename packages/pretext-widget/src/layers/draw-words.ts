import type { WordSpan } from '../layout.js';
import type { WordMotion } from '../effects/engine.js';

export interface DrawOptions {
  canvasTop: number;
  yMin: number;
  yMax: number;
  dpr: number;
  isDark: boolean;
  widthOf: (span: WordSpan) => number;
  /** Motion for a word, or null when no effect is running at all. */
  motionAt: ((index: number, cx: number, cy: number) => WordMotion | null) | null;
}

type DrawingContext = Pick<
  CanvasRenderingContext2D,
  'font' | 'fillStyle' | 'globalAlpha' | 'setTransform' | 'fillText'
>;

/** Draw canvas words, displacing those an effect moves. The plain transform is
 * restored right after each moved word, so later words are never affected. */
export function drawWords(ctx: DrawingContext, spans: WordSpan[], options: DrawOptions) {
  const { canvasTop, yMin, yMax, dpr, isDark, widthOf, motionAt } = options;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    if (!motionAt) {
      ctx.fillText(s.text, s.x, baseline);
      continue;
    }
    const halfWidth = widthOf(s) / 2;
    const cx = s.x + halfWidth;
    const cy = s.y + s.style.lineHeight / 2;
    const motion = motionAt(index, cx, cy);
    if (!motion) {
      ctx.fillText(s.text, s.x, baseline);
      continue;
    }
    // Scale and rotate around the word's centre, at its displaced position.
    const centreY = cy - canvasTop;
    const cos = Math.cos(motion.rotation) * dpr * motion.scale;
    const sin = Math.sin(motion.rotation) * dpr * motion.scale;
    ctx.setTransform(cos, sin, -sin, cos, (cx + motion.dx) * dpr, (centreY + motion.dy) * dpr);
    ctx.fillText(s.text, -halfWidth, baseline - centreY);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}
