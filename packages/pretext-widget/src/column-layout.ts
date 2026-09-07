import { layoutBlocks } from './layout.js';
import type { ColumnBreak, ContentBlock, LayoutResult, ObstacleRect, TextStyle } from './layout.js';

export type ColumnCount = 1 | 2 | 3;

export interface ColumnLayoutOptions {
  count: ColumnCount;
  gap: number;
  /** Height of one newspaper-like column band before content moves right. */
  columnHeight?: number;
  /** Vertical breathing room between successive column bands. */
  bandGap?: number;
}

export interface ColumnFrame {
  left: number;
  right: number;
  width: number;
}

type ColumnTextBlock = Extract<ContentBlock, { type: 'paragraph' | 'listItem' }>;

const DEFAULT_COLUMN_HEIGHT = 980;
const DEFAULT_BAND_GAP = 24;

function emptyLayout(startY: number): LayoutResult {
  return {
    spans: [],
    richBlocks: [],
    figureAnchors: [],
    headingAnchors: [],
    contentBottom: startY,
  };
}

function appendLayout(target: LayoutResult, source: LayoutResult, xOffset = 0) {
  target.spans.push(
    ...source.spans.map((span) => ({
      ...span,
      x: span.x + xOffset,
    })),
  );
  target.richBlocks.push(
    ...source.richBlocks.map((block) => ({
      ...block,
      x: block.x + xOffset,
    })),
  );
  target.figureAnchors.push(
    ...source.figureAnchors.map((anchor) => ({
      ...anchor,
      x: anchor.x + xOffset,
    })),
  );
  target.headingAnchors.push(...source.headingAnchors);
  target.contentBottom = Math.max(target.contentBottom, source.contentBottom);
}

export function getColumnFrames(
  containerWidth: number,
  options: ColumnLayoutOptions,
): ColumnFrame[] {
  const count = Math.max(1, Math.min(3, options.count));
  const gap = count > 1 ? Math.max(0, options.gap) : 0;
  const width = Math.max(1, (containerWidth - gap * (count - 1)) / count);
  return Array.from({ length: count }, (_, index) => {
    const left = index * (width + gap);
    return { left, right: left + width, width };
  });
}

function obstaclesForColumn(obstacles: ObstacleRect[], frame: ColumnFrame): ObstacleRect[] {
  return obstacles
    .filter(
      (obstacle) => obstacle.inline || (obstacle.right > frame.left && obstacle.left < frame.right),
    )
    .map((obstacle) => ({
      ...obstacle,
      left: obstacle.inline ? 0 : Math.max(0, obstacle.left - frame.left),
      right: obstacle.inline ? frame.width : Math.min(frame.width, obstacle.right - frame.left),
    }));
}

function isColumnText(block: ContentBlock): block is ColumnTextBlock {
  return block.type === 'paragraph' || block.type === 'listItem';
}

function containsIframe(node: any): boolean {
  if (!node) return false;
  if (node.type === 'iframe') return true;
  return (node.children ?? []).some((child: any) => containsIframe(child));
}

function isFloatBlock(block: ContentBlock, obstacles: ObstacleRect[]): boolean {
  if (block.type === 'figureAnchor') {
    return obstacles.some(
      (obstacle) => obstacle.inline && obstacle.figureIndex === block.figureIndex,
    );
  }
  return block.type === 'richBlock' && containsIframe(block.node);
}

function obstaclesForPlacedBlock(
  block: ContentBlock,
  obstacles: ObstacleRect[],
  frame: ColumnFrame,
  startY: number,
): ObstacleRect[] {
  const local = obstaclesForColumn(obstacles, frame);
  if (block.type !== 'figureAnchor') return local;
  return local.map((obstacle) => {
    if (!obstacle.inline || obstacle.figureIndex !== block.figureIndex) return obstacle;
    const height = obstacle.bottom - obstacle.top;
    return {
      ...obstacle,
      // Sizing obstacles are created at y=0 because the real anchor is not
      // known until this pass. Move the rectangle to the anchor; expanding it
      // from zero would make its apparent height grow with every later column
      // band and reserve vast areas below otherwise normal figures.
      top: startY,
      bottom: startY + height,
    };
  });
}

function followingKeepHeight(
  blocks: ContentBlock[],
  index: number,
  obstacles: ObstacleRect[],
  frame: ColumnFrame,
  startY: number,
  style: TextStyle,
): number {
  const block = blocks[index];
  if (!block) return 0;
  if (isColumnText(block)) {
    // A heading needs enough following prose to avoid becoming an orphan, but
    // keeping an entire long paragraph together would create the same holes we
    // are trying to eliminate.
    return Math.min(
      estimatePlacedHeight(block, obstacles, frame, startY, style),
      style.lineHeight * 2 + style.paragraphGap,
    );
  }
  if (block.type === 'heading') return 0;
  if (isFloatBlock(block, obstacles)) {
    // A float is not the only possible companion for a heading. Use actual
    // following prose, but never borrow from another section or past a strict
    // equation/table. The float itself is still reserved as an intact unit.
    let next = index;
    while (next < blocks.length && isFloatBlock(blocks[next], obstacles)) next += 1;
    if (blocks[next] && isColumnText(blocks[next])) {
      return followingKeepHeight(blocks, next, obstacles, frame, startY, style);
    }
  }
  return estimatePlacedHeight(block, obstacles, frame, startY, style);
}

function estimatePlacedHeight(
  block: ContentBlock,
  obstacles: ObstacleRect[],
  frame: ColumnFrame,
  startY: number,
  style: TextStyle,
): number {
  if (block.type === 'figureAnchor') {
    const inlineFigure = obstacles.find(
      (obstacle) => obstacle.inline && obstacle.figureIndex === block.figureIndex,
    );
    return inlineFigure ? inlineFigure.bottom - inlineFigure.top + style.paragraphGap : 0;
  }
  const placed = layoutBlocks(
    [block],
    obstaclesForColumn(obstacles, frame),
    frame.width,
    startY,
    style,
  );
  return Math.max(0, placed.contentBottom - startY);
}

function sliceTextBlock(
  block: ColumnTextBlock,
  start: number,
  end: number,
  keepBullet: boolean,
): ColumnTextBlock {
  if (block.type === 'listItem') {
    return {
      ...block,
      bullet: keepBullet ? block.bullet : false,
      words: block.words.slice(start, end),
      continues: end < block.words.length || block.continues,
    };
  }
  return {
    ...block,
    words: block.words.slice(start, end),
    continues: end < block.words.length || block.continues,
  };
}

function findFittingWordCount(
  block: ColumnTextBlock,
  obstacles: ObstacleRect[],
  frame: ColumnFrame,
  startY: number,
  maxBottom: number,
  style: TextStyle,
  keepBullet: boolean,
): number {
  let low = 1;
  let high = block.words.length;
  let best = 0;
  const localObstacles = obstaclesForColumn(obstacles, frame);

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = sliceTextBlock(block, 0, mid, keepBullet);
    const placed = layoutBlocks([candidate], localObstacles, frame.width, startY, style);
    if (placed.contentBottom <= maxBottom) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

/**
 * Lay out the article as a continuous, newspaper-like stream.
 *
 * Every block participates in the same flow. Paragraphs may split at a column
 * edge, while headings, equations, iframes and figures stay intact and move to
 * the next column when necessary. After the last column, reading continues in
 * a new band below. This mirrors paged academic papers without creating one
 * enormous full-height CSS column.
 */
function layoutColumnPass(
  blocks: ContentBlock[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
  options: ColumnLayoutOptions,
  record?: (block: ContentBlock, slot: number, placed: LayoutResult) => void,
  minimumHeight = style.lineHeight * 8,
): LayoutResult {
  if (options.count <= 1) {
    return layoutBlocks(blocks, obstacles, containerWidth, startY, style);
  }

  const frames = getColumnFrames(containerWidth, options);
  const columnHeight = Math.max(minimumHeight, options.columnHeight ?? DEFAULT_COLUMN_HEIGHT);
  const bandGap = Math.max(0, options.bandGap ?? DEFAULT_BAND_GAP);
  const result = emptyLayout(startY);
  let slotIndex = 0;
  let cursorY = startY;
  const reservedBottoms = new Map<number, number>();

  const bandTopFor = (slot: number) =>
    startY + Math.floor(slot / frames.length) * (columnHeight + bandGap);
  const frameFor = (slot: number) => frames[slot % frames.length];
  const columnBottomFor = (slot: number) => bandTopFor(slot) + columnHeight;

  const advanceColumn = () => {
    slotIndex += 1;
    cursorY = Math.max(bandTopFor(slotIndex), reservedBottoms.get(slotIndex) ?? 0);
  };

  const reserveFutureSlotsInFrame = (fromSlot: number, visualBottom: number) => {
    for (
      let futureSlot = fromSlot + frames.length;
      bandTopFor(futureSlot) < visualBottom;
      futureSlot += frames.length
    ) {
      reservedBottoms.set(futureSlot, Math.max(reservedBottoms.get(futureSlot) ?? 0, visualBottom));
    }
  };

  const placeFloatAhead = (block: ContentBlock, blockHeight: number) => {
    let targetSlot = slotIndex + 1;
    while (true) {
      const targetTop = bandTopFor(targetSlot);
      const targetCursor = Math.max(targetTop, reservedBottoms.get(targetSlot) ?? 0);
      const targetBottom = columnBottomFor(targetSlot);
      if (targetCursor === targetTop || targetCursor + blockHeight <= targetBottom) {
        const targetFrame = frameFor(targetSlot);
        const placed = layoutBlocks(
          [block],
          obstaclesForPlacedBlock(block, obstacles, targetFrame, targetCursor),
          targetFrame.width,
          targetCursor,
          style,
        );
        appendLayout(result, placed, targetFrame.left);
        record?.(block, targetSlot, placed);
        reservedBottoms.set(targetSlot, placed.contentBottom);
        reserveFutureSlotsInFrame(targetSlot, placed.contentBottom);
        return;
      }
      targetSlot += 1;
    }
  };

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    if (block.type === 'heading') {
      const frame = frameFor(slotIndex);
      const bandTop = bandTopFor(slotIndex);
      const columnBottom = columnBottomFor(slotIndex);
      const headingHeight = estimatePlacedHeight(block, obstacles, frame, cursorY, style);
      const nextHeight = followingKeepHeight(
        blocks,
        blockIndex + 1,
        obstacles,
        frame,
        cursorY + headingHeight,
        style,
      );
      const keepHeight = Math.min(columnHeight, headingHeight + nextHeight);
      if (cursorY > bandTop && cursorY + keepHeight > columnBottom) {
        advanceColumn();
      }
    }

    if (isColumnText(block)) {
      const frame = frameFor(slotIndex);
      const next = blocks[blockIndex + 1];
      const textHeight = estimatePlacedHeight(block, obstacles, frame, cursorY, style);
      if (
        !block.continues &&
        textHeight <= style.lineHeight * 2 + style.paragraphGap &&
        next?.type === 'richBlock' &&
        !isFloatBlock(next, obstacles)
      ) {
        // Short lead-ins belong with the equation/table they introduce. This
        // is structural, never a match against one paper's wording.
        const pairHeight =
          textHeight + estimatePlacedHeight(next, obstacles, frame, cursorY + textHeight, style);
        if (
          pairHeight <= columnHeight &&
          cursorY > bandTopFor(slotIndex) &&
          cursorY + pairHeight > columnBottomFor(slotIndex)
        ) {
          advanceColumn();
        }
      }
      let remainingBlock = block;
      let keepBullet = true;

      while (remainingBlock.words.length > 0) {
        const frame = frameFor(slotIndex);
        const columnBottom = columnBottomFor(slotIndex);
        const placedHeight = estimatePlacedHeight(remainingBlock, obstacles, frame, cursorY, style);

        if (cursorY + placedHeight <= columnBottom) {
          const placed = layoutBlocks(
            [remainingBlock],
            obstaclesForColumn(obstacles, frame),
            frame.width,
            cursorY,
            style,
          );
          appendLayout(result, placed, frame.left);
          record?.(remainingBlock, slotIndex, placed);
          cursorY = placed.contentBottom;
          remainingBlock = sliceTextBlock(
            remainingBlock,
            remainingBlock.words.length,
            remainingBlock.words.length,
            false,
          );
          continue;
        }

        let fittingWords = findFittingWordCount(
          remainingBlock,
          obstacles,
          frame,
          cursorY,
          columnBottom,
          style,
          keepBullet,
        );
        if (fittingWords === 0) {
          const emptySlot = cursorY === bandTopFor(slotIndex);
          const first = sliceTextBlock(remainingBlock, 0, 1, keepBullet);
          const intrinsicHeight = layoutBlocks([first], [], frame.width, 0, style).contentBottom;
          if (emptySlot && intrinsicHeight > columnHeight) {
            // An indivisible token taller than a page must still make progress.
            fittingWords = 1;
          } else {
            advanceColumn();
            continue;
          }
        }

        const segment = sliceTextBlock(remainingBlock, 0, fittingWords, keepBullet);
        const placed = layoutBlocks(
          [segment],
          obstaclesForColumn(obstacles, frame),
          frame.width,
          cursorY,
          style,
        );
        appendLayout(result, placed, frame.left);
        record?.(segment, slotIndex, placed);
        cursorY = placed.contentBottom;
        reserveFutureSlotsInFrame(slotIndex, placed.contentBottom);
        remainingBlock = sliceTextBlock(
          remainingBlock,
          fittingWords,
          remainingBlock.words.length,
          false,
        );
        keepBullet = false;
        if (remainingBlock.words.length > 0) advanceColumn();
      }
      continue;
    }

    let frame = frameFor(slotIndex);
    let blockHeight = estimatePlacedHeight(block, obstacles, frame, cursorY, style);
    const bandTop = bandTopFor(slotIndex);
    const columnBottom = columnBottomFor(slotIndex);

    // Paper-like floats move forward while later prose fills the remainder of
    // the current column. Equations and headings keep their strict source
    // position and move with the reading cursor.
    if (cursorY > bandTop && cursorY + blockHeight > columnBottom) {
      if (isFloatBlock(block, obstacles)) {
        placeFloatAhead(block, blockHeight);
        continue;
      }
      advanceColumn();
      frame = frameFor(slotIndex);
      blockHeight = estimatePlacedHeight(block, obstacles, frame, cursorY, style);
    }

    const placed = layoutBlocks(
      [block],
      obstaclesForPlacedBlock(block, obstacles, frame, cursorY),
      frame.width,
      cursorY,
      style,
    );
    appendLayout(result, placed, frame.left);
    record?.(block, slotIndex, placed);
    cursorY = placed.contentBottom;
    reserveFutureSlotsInFrame(slotIndex, placed.contentBottom);

    if (blockHeight > 0 && cursorY >= columnBottomFor(slotIndex)) {
      advanceColumn();
    }
  }

  result.contentBottom = Math.max(result.contentBottom, cursorY);
  return result;
}

interface BandPass {
  layout: LayoutResult;
  remaining: ContentBlock[];
  ends: number[];
  breaks: ColumnBreak[];
  deferred: number;
  height: number;
}

/** Lay out only the next band. Unconsumed prose and floats are explicit state,
 * rather than fragments locked into a provisional page several passes ago. */
function flowBand(
  blocks: ContentBlock[],
  obstacles: ObstacleRect[],
  frames: ColumnFrame[],
  top: number,
  height: number,
  style: TextStyle,
  measure: (block: ContentBlock) => { height: number; lines: number },
): BandPass {
  const layout = emptyLayout(top);
  const ends = frames.map(() => top);
  const breaks: ColumnBreak[] = [];
  const deferred: ContentBlock[] = [];
  const bottom = top + height;
  let column = 0;
  let cursor = top;
  let lastFloatColumn = 0;
  let forcedCompanion: ContentBlock | undefined;

  const finish = (remaining: ContentBlock[]): BandPass => {
    layout.contentBottom = Math.max(top, ...ends);
    return {
      layout,
      ends,
      breaks,
      remaining: [...deferred, ...remaining],
      deferred: deferred.length,
      height,
    };
  };
  const advance = (reason: ColumnBreak['reason'], required: number) => {
    breaks.push({ column, reason, remaining: Math.max(0, bottom - cursor), required });
    column += 1;
    cursor = ends[column] ?? top;
  };
  const emit = (block: ContentBlock, target: number, y: number) => {
    const frame = frames[target];
    const placed = layoutBlocks(
      [block],
      obstaclesForPlacedBlock(block, obstacles, frame, y),
      frame.width,
      y,
      style,
    );
    appendLayout(layout, placed, frame.left);
    ends[target] = Math.max(ends[target], placed.contentBottom);
    return placed.contentBottom;
  };
  const floatAhead = (block: ContentBlock) => {
    const required = measure(block).height;
    for (let target = Math.max(column + 1, lastFloatColumn); target < frames.length; target++) {
      if (ends[target] === top || ends[target] + required <= bottom) {
        emit(block, target, ends[target]);
        lastFloatColumn = target;
        return;
      }
    }
    deferred.push(block);
    breaks.push({ column, reason: 'float', remaining: Math.max(0, bottom - cursor), required });
  };

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (column >= frames.length) return finish(blocks.slice(index));

    if (block.type === 'heading') {
      // Do not carry an old section's pending figure behind a new section.
      if (deferred.length) {
        breaks.push({
          column,
          reason: 'section-boundary',
          remaining: Math.max(0, bottom - cursor),
          required: measure(deferred[0]).height,
        });
        return finish(blocks.slice(index));
      }
      while (column < lastFloatColumn) advance('section-boundary', 0);
      const headingHeight = measure(block).height;
      const following = followingKeepHeight(blocks, index + 1, obstacles, frames[column], 0, style);
      const required = headingHeight + following;
      while (cursor > top && cursor + Math.min(height, required) > bottom) {
        advance('heading', required);
        if (column >= frames.length) return finish(blocks.slice(index));
      }
      // An indivisible companion larger than a normal band still belongs to
      // this heading. The caller grows the band to the real occupied height.
      if (required > height && blocks[index + 1] && !isColumnText(blocks[index + 1])) {
        const next = blocks[index + 1];
        if (following === measure(next).height) forcedCompanion = next;
      }
    }

    if (isColumnText(block)) {
      const next = blocks[index + 1];
      const text = measure(block);
      // Count actual rendered lines; tall inline glyphs and pixel rounding
      // must not switch this rule on/off at an arbitrary two-line pixel limit.
      if (
        !block.continues &&
        text.lines <= 2 &&
        next?.type === 'richBlock' &&
        !isFloatBlock(next, obstacles)
      ) {
        const required = text.height + measure(next).height;
        while (cursor > top && cursor + Math.min(height, required) > bottom) {
          advance('lead-in', required);
          if (column >= frames.length) return finish(blocks.slice(index));
        }
        if (required > height) {
          forcedCompanion = next;
          cursor = emit(block, column, cursor);
          continue;
        }
      }
      let rest = block;
      let keepBullet = true;
      while (rest.words.length) {
        if (column >= frames.length) return finish([rest, ...blocks.slice(index + 1)]);
        const required = measure(rest).height;
        if (cursor + required <= bottom) {
          cursor = emit(rest, column, cursor);
          break;
        }
        let count = findFittingWordCount(
          rest,
          obstacles,
          frames[column],
          cursor,
          bottom,
          style,
          keepBullet,
        );
        if (!count) {
          const first = sliceTextBlock(rest, 0, 1, keepBullet);
          if (cursor === top && measure(first).height > height) count = 1;
          else {
            advance('text', measure(first).height);
            continue;
          }
        }
        cursor = emit(sliceTextBlock(rest, 0, count, keepBullet), column, cursor);
        rest = sliceTextBlock(rest, count, rest.words.length, false);
        keepBullet = false;
        if (rest.words.length) advance('text', style.lineHeight);
      }
      continue;
    }

    const required = measure(block).height;
    const floating = isFloatBlock(block, obstacles);
    if (floating && deferred.length) {
      deferred.push(block);
      continue;
    }
    if (floating && column < lastFloatColumn) {
      floatAhead(block);
      continue;
    }
    if (forcedCompanion !== block) {
      while (cursor > top && cursor + required > bottom) {
        if (floating) {
          floatAhead(block);
          break;
        }
        advance('block', required);
        if (column >= frames.length) return finish(blocks.slice(index));
      }
      if (floating && cursor > top && cursor + required > bottom) continue;
    }
    cursor = emit(block, column, cursor);
    if (floating) lastFloatColumn = column;
    if (forcedCompanion === block) forcedCompanion = undefined;
  }
  return finish([]);
}

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
