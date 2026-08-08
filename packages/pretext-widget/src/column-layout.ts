import { layoutBlocks } from './layout.js';
import type {
  ContentBlock,
  LayoutResult,
  ObstacleRect,
  TextStyle,
} from './layout.js';

export type ColumnCount = 1 | 2 | 3;

export interface ColumnLayoutOptions {
  count: ColumnCount;
  gap: number;
}

interface ColumnFrame {
  left: number;
  right: number;
  width: number;
}

type ColumnTextBlock = Extract<ContentBlock, { type: 'paragraph' | 'listItem' }>;

const MIN_COLUMN_GROUP_HEIGHT = 104;

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
      node: block.node,
    })),
  );
  target.figureAnchors.push(...source.figureAnchors);
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

function obstaclesForColumn(
  obstacles: ObstacleRect[],
  frame: ColumnFrame,
): ObstacleRect[] {
  return obstacles
    .filter((obstacle) => obstacle.right > frame.left && obstacle.left < frame.right)
    .map((obstacle) => ({
      ...obstacle,
      left: Math.max(0, obstacle.left - frame.left),
      right: Math.min(frame.width, obstacle.right - frame.left),
    }));
}

function isColumnText(block: ContentBlock): block is ColumnTextBlock {
  return block.type === 'paragraph' || block.type === 'listItem';
}

function estimateBlockHeight(
  block: ContentBlock,
  columnWidth: number,
  style: TextStyle,
): number {
  const estimate = layoutBlocks([block], [], columnWidth, 0, style);
  return Math.max(style.lineHeight, estimate.contentBottom);
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
    };
  }
  return {
    ...block,
    words: block.words.slice(start, end),
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
    const placed = layoutBlocks(
      [candidate],
      localObstacles,
      frame.width,
      startY,
      style,
    );
    if (placed.contentBottom <= maxBottom) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function layoutTextGroup(
  blocks: ColumnTextBlock[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
  options: ColumnLayoutOptions,
): LayoutResult {
  const frames = getColumnFrames(containerWidth, options);
  if (frames.length === 1) {
    return layoutBlocks(blocks, obstacles, containerWidth, startY, style);
  }

  const estimatedHeights = blocks.map((block) =>
    estimateBlockHeight(block, frames[0].width, style),
  );
  const estimatedTotal = estimatedHeights.reduce((sum, height) => sum + height, 0);
  const targetHeight = Math.max(
    MIN_COLUMN_GROUP_HEIGHT,
    Math.ceil(estimatedTotal / frames.length / style.lineHeight) * style.lineHeight,
  );

  const result = emptyLayout(startY);
  const columnBottoms = frames.map(() => startY);
  const columnHasContent = frames.map(() => false);
  let columnIndex = 0;

  blocks.forEach((block, blockIndex) => {
    let remainingBlock = block;
    let keepBullet = true;

    while (remainingBlock.words.length > 0) {
      const estimatedHeight =
        remainingBlock === block
          ? estimatedHeights[blockIndex]
          : estimateBlockHeight(remainingBlock, frames[columnIndex].width, style);
      const currentHeight = columnBottoms[columnIndex] - startY;
      const remainingHeight = targetHeight - currentHeight;

      // Keep a complete paragraph together when it fits in a fresh column.
      if (
        columnHasContent[columnIndex] &&
        estimatedHeight > remainingHeight &&
        estimatedHeight <= targetHeight &&
        columnIndex < frames.length - 1
      ) {
        columnIndex += 1;
        continue;
      }

      const frame = frames[columnIndex];
      if (estimatedHeight > remainingHeight && columnIndex < frames.length - 1) {
        const fittingWords = findFittingWordCount(
          remainingBlock,
          obstacles,
          frame,
          columnBottoms[columnIndex],
          startY + targetHeight,
          style,
          keepBullet,
        );
        if (fittingWords === 0) {
          columnIndex += 1;
          continue;
        }

        const segment = sliceTextBlock(
          remainingBlock,
          0,
          fittingWords,
          keepBullet,
        );
        const placed = layoutBlocks(
          [segment],
          obstaclesForColumn(obstacles, frame),
          frame.width,
          columnBottoms[columnIndex],
          style,
        );
        appendLayout(result, placed, frame.left);
        columnBottoms[columnIndex] = placed.contentBottom;
        columnHasContent[columnIndex] = true;
        remainingBlock = sliceTextBlock(
          remainingBlock,
          fittingWords,
          remainingBlock.words.length,
          false,
        );
        keepBullet = false;
        columnIndex += 1;
        continue;
      }

      const placed = layoutBlocks(
        [sliceTextBlock(remainingBlock, 0, remainingBlock.words.length, keepBullet)],
        obstaclesForColumn(obstacles, frame),
        frame.width,
        columnBottoms[columnIndex],
        style,
      );
      appendLayout(result, placed, frame.left);
      columnBottoms[columnIndex] = placed.contentBottom;
      columnHasContent[columnIndex] = true;
      remainingBlock = sliceTextBlock(remainingBlock, remainingBlock.words.length, remainingBlock.words.length, false);
    }
  });

  result.contentBottom = Math.max(startY, ...columnBottoms);
  return result;
}

/**
 * Lay out article text in newspaper-style column groups.
 *
 * Headings, equations, iframes and figure anchors remain full-width boundaries.
 * Consecutive paragraphs/list items between those boundaries flow top-to-bottom
 * through the requested columns.
 */
export function layoutBlocksInColumns(
  blocks: ContentBlock[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
  options: ColumnLayoutOptions,
): LayoutResult {
  if (options.count <= 1) {
    return layoutBlocks(blocks, obstacles, containerWidth, startY, style);
  }

  const result = emptyLayout(startY);
  let y = startY;
  let blockIndex = 0;

  while (blockIndex < blocks.length) {
    const block = blocks[blockIndex];
    if (isColumnText(block)) {
      const group: ColumnTextBlock[] = [];
      while (blockIndex < blocks.length && isColumnText(blocks[blockIndex])) {
        group.push(blocks[blockIndex] as ColumnTextBlock);
        blockIndex += 1;
      }
      const placed = layoutTextGroup(
        group,
        obstacles,
        containerWidth,
        y,
        style,
        options,
      );
      appendLayout(result, placed);
      y = placed.contentBottom;
      continue;
    }

    const placed = layoutBlocks([block], obstacles, containerWidth, y, style);
    appendLayout(result, placed);
    y = placed.contentBottom;
    blockIndex += 1;
  }

  result.contentBottom = y;
  return result;
}
