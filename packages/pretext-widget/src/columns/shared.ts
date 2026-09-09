import { layoutBlocks } from '../layout/flow.js';
import type { ContentBlock, LayoutResult, ObstacleRect, TextStyle } from '../layout/types.js';
import type { ColumnFrame, ColumnTextBlock, ColumnLayoutOptions } from './types.js';

export function emptyLayout(startY: number): LayoutResult {
  return {
    spans: [],
    richBlocks: [],
    figureAnchors: [],
    headingAnchors: [],
    contentBottom: startY,
  };
}

export function appendLayout(target: LayoutResult, source: LayoutResult, xOffset = 0) {
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

export function obstaclesForColumn(obstacles: ObstacleRect[], frame: ColumnFrame): ObstacleRect[] {
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

export function isColumnText(block: ContentBlock): block is ColumnTextBlock {
  return block.type === 'paragraph' || block.type === 'listItem';
}

function containsIframe(node: any): boolean {
  if (!node) return false;
  if (node.type === 'iframe') return true;
  return (node.children ?? []).some((child: any) => containsIframe(child));
}

export function isFloatBlock(block: ContentBlock, obstacles: ObstacleRect[]): boolean {
  if (block.type === 'figureAnchor') {
    return obstacles.some(
      (obstacle) => obstacle.inline && obstacle.figureIndex === block.figureIndex,
    );
  }
  return block.type === 'richBlock' && containsIframe(block.node);
}

export function obstaclesForPlacedBlock(
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

export function followingKeepHeight(
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

export function estimatePlacedHeight(
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

export function sliceTextBlock(
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

export function findFittingWordCount(
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
