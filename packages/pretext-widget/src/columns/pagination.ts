import { layoutBlocks } from '../layout/flow.js';
import type { ContentBlock, LayoutResult, ObstacleRect, TextStyle } from '../layout/types.js';
import { DEFAULT_COLUMN_HEIGHT, DEFAULT_BAND_GAP } from './types.js';
import type { ColumnLayoutOptions } from './types.js';
import { emptyLayout, appendLayout, getColumnFrames, obstaclesForColumn } from './shared.js';
import { layoutColumnPass } from './obstacle-flow.js';
import { flowBand, type BandPass } from './band-flow.js';

/** Rolling, bounded pagination. Candidate breaks consume different amounts of
 * the remaining source, so later content can fill space freed in this band.
 * Only immutable input is shared by trials; figures and prose commit together. */
export function layoutBlocksInColumns(
  blocks: ContentBlock[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
  options: ColumnLayoutOptions,
): LayoutResult {
  if (options.count <= 1 || obstacles.some((obstacle) => !obstacle.inline)) {
    // Absolute, manually dragged cards retain their obstacle-aware flow.
    return layoutColumnPass(blocks, obstacles, containerWidth, startY, style, options);
  }
  const frames = getColumnFrames(containerWidth, options);
  const localObstacles = obstaclesForColumn(obstacles, frames[0]);
  const measurements = new WeakMap<ContentBlock, { height: number; lines: number }>();
  const measure = (block: ContentBlock) => {
    let measurement = measurements.get(block);
    if (!measurement) {
      const placed = layoutBlocks([block], localObstacles, frames[0].width, 0, style);
      measurement = {
        height: placed.contentBottom,
        lines: new Set(placed.spans.map((s) => s.y)).size,
      };
      measurements.set(block, measurement);
    }
    return measurement;
  };
  const target = Math.max(style.lineHeight * 8, options.columnHeight ?? DEFAULT_COLUMN_HEIGHT);
  const bandGap = Math.max(0, options.bandGap ?? DEFAULT_BAND_GAP);
  const result = emptyLayout(startY);
  result.columnBands = [];
  let remaining = blocks;
  let top = startY;
  while (remaining.length) {
    const trial = (height: number) =>
      flowBand(remaining, obstacles, frames, top, height, style, measure);
    let best = trial(target);
    // A tall, indivisible object can legitimately enlarge a band; all columns
    // receive that height, instead of leaving a hidden overlap in the next one.
    if (best.layout.contentBottom > top + target) best = trial(best.layout.contentBottom - top);
    const gaps = (pass: BandPass) => pass.ends.map((end) => pass.layout.contentBottom - end);
    const score = (pass: BandPass) =>
      gaps(pass).reduce((sum, gap) => sum + (gap * gap) / target, 0) +
      Math.abs(pass.height - target) * 0.15 +
      pass.deferred * style.lineHeight;
    if (best.remaining.length && Math.max(...gaps(best)) > style.lineHeight * 2) {
      // Small, deterministic look-ahead around a preferred page height. No
      // assumption that greedy float/keep constraints are monotone in height.
      for (
        let delta = style.lineHeight * 2;
        delta <= target * 0.25;
        delta += style.lineHeight * 2
      ) {
        for (const height of [target - delta, target + delta]) {
          const candidate = trial(height);
          if (score(candidate) < score(best)) best = candidate;
        }
      }
    }
    if (!best.remaining.length) {
      // Balance the final tail without stretching lines. A bounded grid search
      // also handles non-monotone heading/float transitions that defeat binary search.
      const maximum = best.height;
      const step = Math.max(style.lineHeight, maximum / 24);
      const tailScore = (pass: BandPass) =>
        gaps(pass).reduce((sum, gap) => sum + (gap * gap) / target, 0) +
        (pass.layout.contentBottom - top) * 0.5;
      for (let height = style.lineHeight; height < maximum; height += step) {
        const candidate = trial(height);
        if (!candidate.remaining.length && tailScore(candidate) < tailScore(best)) best = candidate;
      }
      const center = best.height;
      for (const height of [center - step / 2, center + step / 2]) {
        if (height < style.lineHeight || height > maximum) continue;
        const candidate = trial(height);
        if (!candidate.remaining.length && tailScore(candidate) < tailScore(best)) best = candidate;
      }
    }
    // Every accepted pass must consume something. Zero-height anchors count as
    // content too; the finite source queue provides progress in that case.
    if (
      !best.layout.spans.length &&
      !best.layout.richBlocks.length &&
      !best.layout.figureAnchors.length
    ) {
      throw new Error('Column pagination did not consume content');
    }
    appendLayout(result, best.layout);
    result.columnBands.push({
      top,
      bottom: best.layout.contentBottom,
      columnBottoms: best.ends,
      breaks: best.breaks,
    });
    remaining = best.remaining;
    top = best.layout.contentBottom + bandGap;
  }
  return result;
}
