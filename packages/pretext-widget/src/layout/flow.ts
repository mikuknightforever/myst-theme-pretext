import { INLINE_SCROLLBAR_HEIGHT } from './types.js';
import type {
  ContentBlock,
  ObstacleRect,
  TextStyle,
  LayoutResult,
  WordSpan,
  PlacedRichBlock,
  FigureAnchor,
  HeadingAnchor,
  StyledWord,
} from './types.js';
import { measureCached, styleForBlock } from './measurements.js';

/**
 * Return the horizontal segments available for a line spanning [lineTop, lineBottom],
 * avoiding all obstacle rects. Merges overlapping blocked intervals before
 * computing the free gaps.
 */
function getLineSegments(
  lineTop: number,
  lineBottom: number,
  obstacles: ObstacleRect[],
  leftEdge: number,
  rightEdge: number,
  gap = 20,
): Array<[number, number]> {
  // Collect obstacles that overlap ANY part of this line's vertical span
  const active = obstacles.filter((o) => lineBottom > o.top && lineTop < o.bottom);
  if (active.length === 0) return [[leftEdge, rightEdge]];

  // Build blocked intervals with gap padding, sorted by start
  const blocked: Array<[number, number]> = active
    .map((o): [number, number] => [o.left - gap, o.right + gap])
    .sort((a, b) => a[0] - b[0]);

  // Merge overlapping intervals
  const merged: Array<[number, number]> = [];
  for (const interval of blocked) {
    const last = merged[merged.length - 1];
    if (!last || interval[0] > last[1]) {
      merged.push([interval[0], interval[1]]);
    } else {
      last[1] = Math.max(last[1], interval[1]);
    }
  }

  // Free segments are the gaps between merged blocked intervals
  const segments: Array<[number, number]> = [];
  let cursor = leftEdge;
  for (const [blockStart, blockEnd] of merged) {
    if (blockStart > cursor) segments.push([cursor, blockStart]);
    cursor = Math.max(cursor, blockEnd);
  }
  if (cursor < rightEdge) segments.push([cursor, rightEdge]);

  return segments.filter(([s, e]) => e - s > 60);
}

function nextYAfterBlockingObstacles(
  lineTop: number,
  lineBottom: number,
  obstacles: ObstacleRect[],
  gap = 20,
): number {
  let nextY = lineTop + 1;
  for (const obstacle of obstacles) {
    if (lineBottom > obstacle.top && lineTop < obstacle.bottom) {
      nextY = Math.max(nextY, obstacle.bottom + gap);
    }
  }
  return nextY;
}

/**
 * Layout content blocks into positioned word spans, reflowing around obstacles.
 *
 * - Headings and rich blocks keep their width and move below intersecting floats.
 * - Paragraphs and list items reflow word-by-word around all obstacles.
 * - Inline bold / italic / code styles are preserved in each WordSpan.
 */
export function layoutBlocks(
  blocks: ContentBlock[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
  /** Actual measured heights from a previous render pass, indexed by richBlock order. */
  richBlockHeights?: number[],
  /** Minimum vertical distance between initial draggable-figure anchors. */
  minFigureAnchorSpacing = 0,
): LayoutResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      spans: [],
      richBlocks: [],
      figureAnchors: [],
      headingAnchors: [],
      contentBottom: startY,
    };
  }

  const spans: WordSpan[] = [];
  const richBlocks: PlacedRichBlock[] = [];
  const figureAnchors: FigureAnchor[] = [];
  const headingAnchors: HeadingAnchor[] = [];
  let y = startY;
  let richIdx = 0;
  let previousFigureAnchorY = Number.NEGATIVE_INFINITY;
  const floatingObstacles = obstacles.filter((o) => !o.inline);
  const clearFullWidthBlock = (top: number, height: number) => {
    let next = top;
    for (;;) {
      const blocked = floatingObstacles.filter(
        (o) => o.right > 0 && o.left < containerWidth && next < o.bottom && next + height > o.top,
      );
      if (!blocked.length) return next;
      next = Math.max(...blocked.map((o) => o.bottom)) + style.paragraphGap;
    }
  };

  for (const block of blocks) {
    // ── Figure anchors (zero-height, record y position) ──────────────────────
    if (block.type === 'figureAnchor') {
      const inlineFigure = obstacles.find(
        (obstacle) => obstacle.inline && obstacle.figureIndex === block.figureIndex,
      );
      const figureHeight = inlineFigure ? inlineFigure.bottom - inlineFigure.top : 0;
      const anchorY = clearFullWidthBlock(
        Math.max(y, previousFigureAnchorY + minFigureAnchorSpacing),
        figureHeight,
      );
      figureAnchors.push({
        figureIndex: block.figureIndex,
        x: 0,
        y: anchorY,
        width: containerWidth,
      });
      previousFigureAnchorY = anchorY;
      if (inlineFigure) {
        // Render inline cards at this pass's anchor, never their stale position.
        y = anchorY + figureHeight + style.paragraphGap;
      }
      continue;
    }

    // ── Rich blocks (math, tables, etc.) ────────────────────────────────────
    if (block.type === 'richBlock') {
      const measuredH = richBlockHeights?.[richIdx];
      const height = measuredH != null ? measuredH : block.estimatedHeight;
      y = clearFullWidthBlock(y, height);
      richBlocks.push({
        node: block.node,
        richBlockIndex: block.richBlockIndex ?? richIdx,
        x: 0,
        y,
        width: containerWidth,
        estimatedHeight: height,
      });
      y += height + style.paragraphGap;
      richIdx++;
      continue;
    }

    // ── Text blocks ─────────────────────────────────────────────────────────
    const blockStyle = styleForBlock(block, style);
    // Inline figures reserve their height at their own figureAnchor above.
    // Letting their absolute rectangles participate here can make a later
    // figure block earlier paragraphs and create a large blank region.
    const blockObstacles =
      block.type === 'heading' ? [] : obstacles.filter((obstacle) => !obstacle.inline);

    if (block.type === 'heading' && floatingObstacles.length) {
      const height = layoutBlocks([block], [], containerWidth, 0, style).contentBottom;
      y = clearFullWidthBlock(y, height);
    }

    // Extra vertical space before headings
    if (block.type === 'heading') y += Math.round(blockStyle.lineHeight * 0.6);
    if (block.type === 'heading') {
      headingAnchors.push({
        id: block.headingId,
        title: block.headingTitle,
        depth: block.depth,
        y,
      });
    }

    // Prepend bullet for list items
    const isListItem = block.type === 'listItem' && block.bullet;
    const words: StyledWord[] = isListItem
      ? [{ text: '•', bold: false, italic: false, code: false, spaceAfter: true }, ...block.words]
      : block.words;

    let wi = 0;
    while (wi < words.length) {
      const wiAtLineStart = wi;
      const spanStart = spans.length;
      let lineHeight = blockStyle.lineHeight;
      // Recheck obstacles whenever an inline formula enlarges the line box.
      let retryLine: boolean;
      do {
        retryLine = false;
        wi = wiAtLineStart;
        spans.length = spanStart;
        const segments = getLineSegments(y, y + lineHeight, blockObstacles, 0, containerWidth);
        if (segments.length === 0) {
          y = Math.max(
            y + lineHeight,
            nextYAfterBlockingObstacles(y, y + lineHeight, blockObstacles),
          );
          retryLine = true;
          continue;
        }

        for (const [segStart, segEnd] of segments) {
          let x = segStart;
          let placedInSegment = false;
          // Indent list items past their bullet on continuation lines
          if (isListItem && wi > 0 && segStart === 0) x += 18;
          while (wi < words.length) {
            const word = words[wi];
            const ww = measureCached(word, blockStyle, ctx);
            const previous = wi > 0 ? words[wi - 1] : undefined;
            const gap = placedInSegment && (previous?.spaceAfter || word.spaceBefore) ? 6 : 0;
            // Keep source-attached fragments together, e.g. abbreviation + plural
            // suffix (`KAN` + `s`) and parentheses around inline math.
            let clusterWidth = ww;
            let clusterEnd = wi + 1;
            while (
              clusterEnd < words.length &&
              !words[clusterEnd - 1].spaceAfter &&
              !words[clusterEnd].spaceBefore
            ) {
              clusterWidth += measureCached(words[clusterEnd], blockStyle, ctx);
              clusterEnd++;
            }
            const segmentWidth = segEnd - segStart;
            const requiredWidth = clusterWidth <= segmentWidth ? clusterWidth : ww;
            if (x + gap + requiredWidth > segEnd) break;
            const wordHeight = Math.max(blockStyle.lineHeight, word.measuredHeight ?? 0);
            if (wordHeight > lineHeight) {
              lineHeight = wordHeight;
              retryLine = true;
              break;
            }
            x += gap;
            spans.push({
              text: word.text,
              x,
              y,
              style: blockStyle,
              bold: word.bold,
              italic: word.italic,
              code: word.code,
              math: word.math,
              mathHtml: word.mathHtml,
              semanticNode: word.semanticNode,
              height: wordHeight,
            });
            x += ww;
            wi++;
            placedInSegment = true;
          }
          if (retryLine) break;
        }
        if (retryLine) continue;
        // Never discard an over-wide token. Semantic tokens (especially inline
        // math/code/links) are clamped to the column and rendered with their own
        // horizontal scroller by MathCodeLayer.
        if (wi === wiAtLineStart) {
          const [segStart, segEnd] = segments[0];
          const word = words[wi];
          const wordHeight =
            Math.max(blockStyle.lineHeight, word.measuredHeight ?? 0) + INLINE_SCROLLBAR_HEIGHT;
          if (wordHeight > lineHeight) {
            lineHeight = wordHeight;
            retryLine = true;
            continue;
          }
          spans.push({
            text: word.text,
            x: segStart,
            y,
            style: blockStyle,
            bold: word.bold,
            italic: word.italic,
            code: word.code,
            math: word.math,
            mathHtml: word.mathHtml,
            semanticNode: word.semanticNode,
            maxWidth: Math.max(1, segEnd - segStart),
            height: wordHeight,
          });
          wi++;
        }
      } while (retryLine);
      y += lineHeight;
    }

    // Vertical gap after each block
    y +=
      block.type === 'heading'
        ? Math.round(blockStyle.lineHeight * 0.3)
        : block.continues
          ? 0
          : style.paragraphGap;
  }

  return { spans, richBlocks, figureAnchors, headingAnchors, contentBottom: y };
}
