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
import { fontKeyOf, measureCached, styleForBlock } from './measurements.js';

let sharedContext: { owner: Document; ctx: CanvasRenderingContext2D | null } | null = null;
/** One canvas context for all measuring, instead of a new canvas per layout call. */
function measuringContext(): CanvasRenderingContext2D | null {
  if (sharedContext?.owner !== document) {
    sharedContext = { owner: document, ctx: document.createElement('canvas').getContext('2d') };
  }
  return sharedContext.ctx;
}

const WORD_GAP = 6;
/** A justified gap may grow to at most 5 normal spaces; only lines that would
 * need more (one or two words) stay left aligned. */
const JUSTIFY_MAX_EXTRA = WORD_GAP * 4;
/** Cost of a non-final line with no gap to stretch (a lone word). */
const LONE_WORD_COST = 10_000;
/** Small cost per line, so equally even layouts prefer fewer lines. */
const LINE_COST = 1;

/** Per word, per (line width, font): whether a justified line starts at it.
 * Stored on the word objects so a paragraph split across columns reuses the
 * breaks chosen for the whole paragraph. */
const justifiedBreaks = new WeakMap<StyledWord, Map<string, boolean>>();

/** Minimum-raggedness line breaking for a justified paragraph (the idea behind
 * Knuth–Plass): choose all breaks together so the stretch is spread evenly,
 * instead of filling each line greedily. Breaks only where the source has a
 * space. Returns the word indices that start a line (0 excluded). */
function chooseJustifiedBreaks(
  words: StyledWord[],
  widths: number[],
  lineWidth: number,
  lastLineIsFinal: boolean,
): Set<number> {
  const n = words.length;
  const breakable = (i: number) =>
    i === 0 || i === n || Boolean(words[i - 1].spaceAfter || words[i].spaceBefore);
  const best = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const from = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    if (!breakable(j)) continue;
    let natural = 0;
    let gaps = 0;
    for (let i = j - 1; i >= 0; i--) {
      natural += widths[i];
      if (i < j - 1 && breakable(i + 1)) {
        natural += WORD_GAP;
        gaps++;
      }
      if (natural > lineWidth && i < j - 1) break;
      if (!breakable(i) || best[i] === Number.POSITIVE_INFINITY) continue;
      let cost: number;
      if (j === n && lastLineIsFinal) cost = 0;
      else if (natural >= lineWidth) cost = 0;
      else if (gaps === 0) cost = LONE_WORD_COST;
      else cost = ((lineWidth - natural) / gaps / WORD_GAP) ** 2 * 100;
      const total = best[i] + cost + LINE_COST;
      if (total < best[j]) {
        best[j] = total;
        from[j] = i;
      }
    }
  }
  const starts = new Set<number>();
  if (best[n] === Number.POSITIVE_INFINITY) return starts;
  for (let j = n; j > 0; j = from[j]) if (from[j] > 0) starts.add(from[j]);
  return starts;
}

interface PlacedSegment {
  from: number;
  to: number;
  end: number;
  widths: number[];
}

/** Stretch one line segment to its right edge by widening its word gaps.
 * Word widths and line breaks are untouched. */
function justifySegment(spans: WordSpan[], segment: PlacedSegment, skipFirstGap: boolean) {
  const { from, to, end, widths } = segment;
  if (to - from < 2) return;
  const gaps: number[] = [];
  for (let k = from + 1; k < to; k++) {
    if (skipFirstGap && k === from + 1) continue;
    if (spans[k].x - (spans[k - 1].x + widths[k - 1 - from]) > 0.5) gaps.push(k);
  }
  if (gaps.length === 0) return;
  const slack = end - (spans[to - 1].x + widths[to - 1 - from]);
  const extra = slack / gaps.length;
  if (extra <= 0 || extra > JUSTIFY_MAX_EXTRA) return;
  let shift = 0;
  let next = 0;
  for (let k = from + 1; k < to; k++) {
    if (gaps[next] === k) {
      shift += extra;
      next++;
    }
    spans[k].x += shift;
  }
}

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
  /** Receives each text line's first word index (within the block's own words)
   * and bottom edge, so callers can cut a block at a line without laying it
   * out again (pretext's line-by-line pattern). */
  lineLog?: Array<{ start: number; bottom: number }>,
): LayoutResult {
  const ctx = measuringContext();
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
    const blockFont = fontKeyOf(blockStyle);
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

    // Justified paragraphs with full-width lines get paragraph-wide breaks.
    let forcedBreaks: Set<number> | null = null;
    if (
      blockStyle.textAlign === 'justify' &&
      block.type === 'paragraph' &&
      blockObstacles.length === 0 &&
      words.length > 1
    ) {
      const key = `${containerWidth}|${blockStyle.fontFamily}|${blockStyle.fontSize}|${blockStyle.fontWeight}`;
      const cached = words.slice(1).map((word) => justifiedBreaks.get(word)?.get(key));
      if (cached.every((value) => value !== undefined)) {
        forcedBreaks = new Set(cached.flatMap((value, i) => (value ? [i + 1] : [])));
      } else {
        const widths = words.map((word) => measureCached(word, blockStyle, ctx, blockFont));
        forcedBreaks = chooseJustifiedBreaks(words, widths, containerWidth, !block.continues);
        words.forEach((word, i) => {
          if (i === 0) return;
          let entry = justifiedBreaks.get(word);
          if (!entry) justifiedBreaks.set(word, (entry = new Map()));
          entry.set(key, forcedBreaks!.has(i));
        });
      }
    }

    let wi = 0;
    while (wi < words.length) {
      const wiAtLineStart = wi;
      const spanStart = spans.length;
      let lineHeight = blockStyle.lineHeight;
      let placedSegments: PlacedSegment[] = [];
      // Recheck obstacles whenever an inline formula enlarges the line box.
      let retryLine: boolean;
      do {
        retryLine = false;
        wi = wiAtLineStart;
        spans.length = spanStart;
        placedSegments = [];
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
          const segment: PlacedSegment = {
            from: spans.length,
            to: spans.length,
            end: segEnd,
            widths: [],
          };
          // Indent list items past their bullet on continuation lines
          if (isListItem && wi > 0 && segStart === 0) x += 18;
          while (wi < words.length) {
            if (placedInSegment && forcedBreaks?.has(wi)) break;
            const word = words[wi];
            const ww = measureCached(word, blockStyle, ctx, blockFont);
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
              clusterWidth += measureCached(words[clusterEnd], blockStyle, ctx, blockFont);
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
            segment.widths.push(ww);
          }
          segment.to = spans.length;
          if (segment.to > segment.from) placedSegments.push(segment);
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
      lineLog?.push({ start: wiAtLineStart - (isListItem ? 1 : 0), bottom: y + lineHeight });
      if (blockStyle.textAlign === 'justify' && block.type !== 'heading') {
        // The paragraph's final line stays left aligned, unless the paragraph
        // continues in the next column.
        const endsParagraph = wi >= words.length && !block.continues;
        placedSegments.forEach((segment, index) => {
          if (endsParagraph && index === placedSegments.length - 1) return;
          justifySegment(spans, segment, Boolean(isListItem) && wiAtLineStart === 0 && index === 0);
        });
      }
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
