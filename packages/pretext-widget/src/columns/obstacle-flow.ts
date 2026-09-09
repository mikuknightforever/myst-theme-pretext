import { layoutBlocks } from '../layout/flow.js';
import type { ContentBlock, LayoutResult, ObstacleRect, TextStyle } from '../layout/types.js';
import { DEFAULT_COLUMN_HEIGHT, DEFAULT_BAND_GAP } from './types.js';
import type { ColumnLayoutOptions } from './types.js';
import {
  emptyLayout,
  appendLayout,
  getColumnFrames,
  obstaclesForColumn,
  isColumnText,
  isFloatBlock,
  obstaclesForPlacedBlock,
  followingKeepHeight,
  estimatePlacedHeight,
  sliceTextBlock,
  findFittingWordCount,
} from './shared.js';

/**
 * Lay out the article as a continuous, newspaper-like stream.
 *
 * Every block participates in the same flow. Paragraphs may split at a column
 * edge, while headings, equations, iframes and figures stay intact and move to
 * the next column when necessary. After the last column, reading continues in
 * a new band below. This mirrors paged academic papers without creating one
 * enormous full-height CSS column.
 */
export function layoutColumnPass(
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
    for (;;) {
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
      const initialFrame = frameFor(slotIndex);
      const next = blocks[blockIndex + 1];
      const textHeight = estimatePlacedHeight(block, obstacles, initialFrame, cursorY, style);
      if (
        !block.continues &&
        textHeight <= style.lineHeight * 2 + style.paragraphGap &&
        next?.type === 'richBlock' &&
        !isFloatBlock(next, obstacles)
      ) {
        // Short lead-ins belong with the equation/table they introduce. This
        // is structural, never a match against one paper's wording.
        const pairHeight =
          textHeight +
          estimatePlacedHeight(next, obstacles, initialFrame, cursorY + textHeight, style);
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
