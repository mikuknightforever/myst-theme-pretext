import { layoutBlocks } from '../layout/flow.js';
import type {
  ColumnBreak,
  ContentBlock,
  LayoutResult,
  ObstacleRect,
  TextStyle,
} from '../layout/types.js';
import type { ColumnFrame } from './types.js';
import {
  emptyLayout,
  appendLayout,
  isColumnText,
  isFloatBlock,
  obstaclesForPlacedBlock,
  followingKeepHeight,
  sliceTextBlock,
  findFittingWordCount,
} from './shared.js';

export interface BandPass {
  layout: LayoutResult;
  remaining: ContentBlock[];
  ends: number[];
  breaks: ColumnBreak[];
  deferred: number;
  height: number;
}

/** Lay out only the next band. Unconsumed prose and floats are explicit state,
 * rather than fragments locked into a provisional page several passes ago. */
export function flowBand(
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
