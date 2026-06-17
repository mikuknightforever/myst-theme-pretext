export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  lineHeight: 24,
  paragraphGap: 16,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontWeight: '400',
  color: 'CanvasText',
};

export interface ObstacleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A single word with its inline formatting flags. */
export interface StyledWord {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  math?: boolean;    // inline math
  mathHtml?: string; // pre-rendered KaTeX HTML from MyST build pipeline
}

/** A block of content extracted from MDAST. */
export type ContentBlock =
  | { type: 'paragraph' | 'heading' | 'listItem'; depth?: number; bullet?: boolean; words: StyledWord[] }
  | { type: 'richBlock'; node: any; estimatedHeight: number };

/** A rich block placed at an absolute Y position for React rendering. */
export interface PlacedRichBlock {
  node: any;
  y: number;
  estimatedHeight: number;
}

/** Return value of layoutBlocks. */
export interface LayoutResult {
  spans: WordSpan[];
  richBlocks: PlacedRichBlock[];
}

/** A positioned word span ready for rendering. */
export interface WordSpan {
  text: string;
  x: number;
  y: number;
  style: TextStyle;
  bold: boolean;
  italic: boolean;
  code: boolean;
  math?: boolean;
  mathHtml?: string; // pre-rendered KaTeX HTML — use dangerouslySetInnerHTML
}

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';

function measureWord(word: StyledWord, style: TextStyle, ctx: CanvasRenderingContext2D): number {
  if (word.math) {
    // Estimate rendered KaTeX width from the LaTeX source:
    // strip command names (e.g. \sum → S), count remaining glyphs, scale by font size.
    const glyphs = word.text
      .replace(/\\[a-zA-Z]+/g, 'W') // each command ≈ one wide glyph
      .replace(/[{}]/g, '')
      .replace(/\s+/g, '');
    return Math.max(16, glyphs.length * style.fontSize * 0.52);
  }
  const weight = word.bold ? '700' : style.fontWeight;
  const modifier = word.italic ? 'italic ' : '';
  const family = word.code ? CODE_FONT : style.fontFamily;
  ctx.font = `${modifier}${weight} ${style.fontSize}px ${family}`;
  return ctx.measureText(word.text).width;
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
  const active = obstacles.filter(
    (o) => lineBottom > o.top && lineTop < o.bottom,
  );
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

/**
 * Recursively extract styled words from an MDAST inline node tree.
 * Handles: text, inlineCode, strong, emphasis, link, and generic parents.
 */
function extractWords(
  node: any,
  bold = false,
  italic = false,
  code = false,
): StyledWord[] {
  if (!node) return [];
  if (node.type === 'text') {
    return (node.value as string)
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((text) => ({ text, bold, italic, code }));
  }
  if (node.type === 'inlineCode') {
    return [{ text: node.value as string, bold, italic, code: true }];
  }
  if (node.type === 'inlineMath') {
    return [{ text: node.value as string, bold: false, italic: false, code: false, math: true, mathHtml: node.html as string | undefined }];
  }
  if (node.type === 'strong') {
    return (node.children ?? []).flatMap((c: any) => extractWords(c, true, italic, code));
  }
  if (node.type === 'emphasis') {
    return (node.children ?? []).flatMap((c: any) => extractWords(c, bold, true, code));
  }
  if (node.children) {
    return (node.children as any[]).flatMap((c: any) => extractWords(c, bold, italic, code));
  }
  return [];
}

/**
 * Walk an MDAST tree and collect content blocks:
 * paragraphs, headings, and list items — with inline formatting preserved.
 */
export function collectBlocks(mdast: any): ContentBlock[] {
  const results: ContentBlock[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'paragraph') {
      const words = (node.children ?? []).flatMap((c: any) => extractWords(c));
      if (words.length > 0) results.push({ type: 'paragraph', words });
      return;
    }
    if (node.type === 'heading') {
      const words = (node.children ?? []).flatMap((c: any) => extractWords(c, true));
      if (words.length > 0) results.push({ type: 'heading', depth: node.depth ?? 2, words });
      return;
    }
    if (node.type === 'listItem') {
      const words = (node.children ?? []).flatMap((c: any) => {
        if (c.type === 'paragraph') {
          return (c.children ?? []).flatMap((cc: any) => extractWords(cc));
        }
        return extractWords(c);
      });
      if (words.length > 0) results.push({ type: 'listItem', bullet: true, words });
      return;
    }
    if (node.type === 'math') {
      // Block math: estimate height from line count, place as rich block
      const lines = (node.value as string).split('\n').filter(Boolean).length;
      const estimatedHeight = Math.max(72, lines * 38 + 32);
      results.push({ type: 'richBlock', node, estimatedHeight });
      return;
    }
    // Don't descend into figure containers — those become cards, not text
    if (node.type === 'container') return;
    if (node.children) {
      for (const child of node.children as any[]) walk(child);
    }
  }
  walk(mdast);
  return results;
}

/** Derive TextStyle for a block (headings get larger/bolder text). */
function styleForBlock(block: ContentBlock, base: TextStyle): TextStyle {
  if (block.type === 'heading') {
    const depth = block.depth ?? 2;
    const fontSize = depth === 1 ? 28 : depth === 2 ? 22 : 18;
    return {
      ...base,
      fontSize,
      lineHeight: Math.round(fontSize * 1.35),
      fontWeight: '700',
    };
  }
  return base;
}

/**
 * Layout content blocks into positioned word spans, reflowing around obstacles.
 *
 * - Headings are always full-width (not deflected by obstacles).
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
): LayoutResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { spans: [], richBlocks: [] };

  const spans: WordSpan[] = [];
  const richBlocks: PlacedRichBlock[] = [];
  let y = startY;
  let richIdx = 0;

  for (const block of blocks) {
    // ── Rich blocks (math, tables, etc.) ────────────────────────────────────
    if (block.type === 'richBlock') {
      const measuredH = richBlockHeights?.[richIdx];
      const height = measuredH != null ? measuredH : block.estimatedHeight;
      richBlocks.push({ node: block.node, y, estimatedHeight: height });
      y += height + style.paragraphGap;
      richIdx++;
      continue;
    }

    // ── Text blocks ─────────────────────────────────────────────────────────
    const blockStyle = styleForBlock(block, style);
    // Headings are never deflected — they always span full width
    const blockObstacles = block.type === 'heading' ? [] : obstacles;

    // Extra vertical space before headings
    if (block.type === 'heading') y += Math.round(blockStyle.lineHeight * 0.6);

    // Prepend bullet for list items
    const words: StyledWord[] = block.bullet
      ? [{ text: '•', bold: false, italic: false, code: false }, ...block.words]
      : block.words;

    let wi = 0;
    while (wi < words.length) {
      const segments = getLineSegments(
        y,
        y + blockStyle.lineHeight,
        blockObstacles,
        0,
        containerWidth,
      );

      for (const [segStart, segEnd] of segments) {
        let x = segStart;
        // Indent list items past their bullet on continuation lines
        if (block.bullet && wi > 0 && segStart === 0) x += 18;
        while (wi < words.length) {
          const word = words[wi];
          const ww = measureWord(word, blockStyle, ctx);
          if (x + ww > segEnd) break;
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
          });
          x += ww + (word.code || word.math ? 4 : 6);
          wi++;
        }
      }
      y += blockStyle.lineHeight;
    }

    // Vertical gap after each block
    y += block.type === 'heading'
      ? Math.round(blockStyle.lineHeight * 0.3)
      : style.paragraphGap;
  }

  return { spans, richBlocks };
}

// ── Legacy helpers (kept for external use) ──────────────────────────────────

export function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.children) {
    return (node.children as any[]).map(extractTextFromNode).join('');
  }
  return '';
}

export function collectParagraphs(mdast: any): string[] {
  const results: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'paragraph') {
      const text = extractTextFromNode(node).trim();
      if (text) results.push(text);
      return;
    }
    if (node.children) {
      for (const child of node.children as any[]) walk(child);
    }
  }
  walk(mdast);
  return results;
}

export function findAllDraggableNodes(mdast: any, selector: string): any[] {
  const results: any[] = [];
  function walk(node: any) {
    if (!node) return;
    const cls: string = node.class ?? node.className ?? '';
    if (cls.split(/\s+/).includes(selector)) {
      results.push(node);
      return;
    }
    if (node.children) {
      for (const child of node.children as any[]) walk(child);
    }
  }
  walk(mdast);
  return results;
}

export function findImageUrl(node: any): string | null {
  if (!node) return null;
  if (node.type === 'image') return node.url ?? null;
  if (node.children) {
    for (const child of node.children as any[]) {
      const url = findImageUrl(child);
      if (url) return url;
    }
  }
  return null;
}
