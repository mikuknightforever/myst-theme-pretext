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
  /** Matching draggable figure, when this obstacle represents a figure card. */
  figureIndex?: number;
  /** True while the figure is still in its original article-flow position. */
  inline?: boolean;
}

/** A single word with its inline formatting flags. */
export interface StyledWord {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  /** Whitespace present immediately before/after this token in the source. */
  spaceBefore?: boolean;
  spaceAfter?: boolean;
  math?: boolean;    // inline math
  mathHtml?: string; // pre-rendered KaTeX HTML from MyST build pipeline
  /** Preserve interactive inline nodes for MyST's native hover/link renderers. */
  semanticNode?: any;
}

/** A block of content extracted from MDAST. */
export type ContentBlock =
  | { type: 'paragraph' | 'listItem'; bullet?: boolean; words: StyledWord[] }
  | {
      type: 'heading';
      depth: number;
      words: StyledWord[];
      headingId: string;
      headingTitle: string;
    }
  | { type: 'richBlock'; node: any; estimatedHeight: number }
  | { type: 'figureAnchor'; figureIndex: number };

/** A rich block placed at an absolute Y position for React rendering. */
export interface PlacedRichBlock {
  node: any;
  y: number;
  estimatedHeight: number;
}

/** Y position of a figure anchor in the text flow. */
export interface FigureAnchor {
  figureIndex: number;
  y: number;
}

/** A heading position used by Pretext Mode's document outline. */
export interface HeadingAnchor {
  id: string;
  title: string;
  depth: number;
  y: number;
}

/** Return value of layoutBlocks. */
export interface LayoutResult {
  spans: WordSpan[];
  richBlocks: PlacedRichBlock[];
  figureAnchors: FigureAnchor[];
  headingAnchors: HeadingAnchor[];
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
  semanticNode?: any; // rendered through MyST to retain links and hover cards
}

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';

function measureWord(word: StyledWord, style: TextStyle, ctx: CanvasRenderingContext2D): number {
  if (word.math) {
    const glyphs = word.text
      .replace(/\\[a-zA-Z]+/g, 'W')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, '');
    // KaTeX glyph boxes and operator spacing are wider than plain canvas text.
    return Math.max(18, glyphs.length * style.fontSize * 0.62 + 4);
  }
  const weight = word.bold ? '700' : style.fontWeight;
  const modifier = word.italic ? 'italic ' : '';
  const family = word.code ? CODE_FONT : style.fontFamily;
  ctx.font = `${modifier}${weight} ${style.fontSize}px ${family}`;
  return ctx.measureText(word.text).width;
}

/** Cross-call cache for word widths (persists across layoutBlocks calls for same document). */
const _widthCache = new Map<string, number>();

function measureCached(word: StyledWord, style: TextStyle, ctx: CanvasRenderingContext2D): number {
  const k = `${style.fontSize}|${style.fontWeight}|${word.italic?1:0}|${word.code?1:0}|${word.math?1:0}|${word.text}`;
  let v = _widthCache.get(k);
  if (v === undefined) {
    v = measureWord(word, style, ctx);
    _widthCache.set(k, v);
  }
  return v;
}

const SEMANTIC_INLINE_TYPES = new Set([
  'abbreviation',
  'cite',
  'citeGroup',
  'crossReference',
  'footnoteReference',
  'link',
]);

/** Plain-text approximation used only to measure semantic inline nodes. */
function semanticText(node: any): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'inlineMath') {
    return String(node.value ?? '');
  }
  if (node.type === 'footnoteReference') {
    return `[${node.enumerator ?? node.number ?? node.identifier ?? ''}]`;
  }
  if (node.type === 'citeGroup') {
    const children = (node.children ?? []).map((child: any) => semanticText(child));
    const allCitations = (node.children ?? []).every((child: any) => child.type === 'cite');
    const separator = allCitations && node.kind === 'parenthetical' ? '; ' : ', ';
    const body = children.join(separator);
    return node.kind === 'parenthetical' ? `(${body})` : body;
  }
  const children = (node.children ?? []).map((child: any) => semanticText(child)).join('');
  const fallback = node.enumerator ?? node.label ?? node.identifier ?? node.title ?? node.url ?? '';
  const body = children || fallback;
  const prefix = node.prefix ? `${node.prefix} ` : '';
  return `${prefix}${body}${node.suffix ?? ''}`.trim();
}

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
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
    const value = String(node.value ?? '').replace(/\s+/g, ' ');
    const words: StyledWord[] = [];
    const tokenPattern = /\S+/g;
    let match: RegExpExecArray | null;
    while ((match = tokenPattern.exec(value)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      words.push({
        text: match[0],
        bold,
        italic,
        code,
        spaceBefore: start > 0 && /\s/.test(value[start - 1]),
        spaceAfter: end < value.length && /\s/.test(value[end]),
      });
    }
    return words;
  }
  if (node.type === 'inlineCode') {
    return [{ text: node.value as string, bold, italic, code: true }];
  }
  if (node.type === 'inlineMath') {
    return [{ text: node.value as string, bold: false, italic: false, code: false, math: true, mathHtml: node.html as string | undefined }];
  }
  if (node.type === 'citeGroup') {
    const children: any[] = node.children ?? [];
    const allCitations = children.every((child: any) => child.type === 'cite');
    const separator = allCitations && node.kind === 'parenthetical' ? ';' : ',';
    const words: StyledWord[] = [];
    if (node.kind === 'parenthetical') {
      words.push({ text: '(', bold, italic, code });
    }
    children.forEach((child: any, index: number) => {
      const text = semanticText(child);
      if (text) words.push({ text, bold, italic, code, semanticNode: child });
      if (index < children.length - 1) {
        words.push({ text: separator, bold, italic, code, spaceAfter: true });
      }
    });
    if (node.kind === 'parenthetical') {
      words.push({ text: ')', bold, italic, code });
    }
    return words;
  }
  if (SEMANTIC_INLINE_TYPES.has(node.type)) {
    const text = semanticText(node);
    return text ? [{ text, bold, italic, code, semanticNode: node }] : [];
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
  let figureIdx = 0;
  const headingIds = new Map<string, number>();
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'paragraph') {
      const words = (node.children ?? []).flatMap((c: any) => extractWords(c));
      if (words.length > 0) results.push({ type: 'paragraph', words });
      return;
    }
    if (node.type === 'heading') {
      const plainTitle = semanticText(node).trim() || 'Untitled section';
      const title = node.enumerator ? `${node.enumerator} ${plainTitle}` : plainTitle;
      const requestedId = String(
        node.html_id ?? node.identifier ?? node.label ?? slugifyHeading(plainTitle),
      ).replace(/^#/, '');
      const seen = headingIds.get(requestedId) ?? 0;
      headingIds.set(requestedId, seen + 1);
      const headingId = seen === 0 ? requestedId : `${requestedId}-${seen + 1}`;
      const enumWord: StyledWord[] = node.enumerator
        ? [{ text: String(node.enumerator), bold: true, italic: false, code: false, spaceAfter: true }]
        : [];
      const words = [...enumWord, ...(node.children ?? []).flatMap((c: any) => extractWords(c, true))];
      if (words.length > 0) {
        results.push({
          type: 'heading',
          depth: node.depth ?? 2,
          words,
          headingId,
          headingTitle: title,
        });
      }
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
      const lines = (node.value as string).split('\n').filter(Boolean).length;
      const estimatedHeight = Math.max(72, lines * 38 + 32);
      results.push({ type: 'richBlock', node, estimatedHeight });
      return;
    }
    if (node.type === 'iframe') {
      const heightVal = node.height ?? '400px';
      const h = typeof heightVal === 'number' ? heightVal : parseInt(String(heightVal)) || 400;
      // +100: 24px top/bottom padding + ~60px caption + 16px caption padding
      results.push({ type: 'richBlock', node, estimatedHeight: h + 100 });
      return;
    }
    if (node.type === 'container') {
      // Pretext-draggable containers are figure cards — record anchor, then skip
      const cls = String(node.class ?? node.className ?? '');
      if (cls.split(/\s+/).includes('pretext-draggable')) {
        results.push({ type: 'figureAnchor', figureIndex: figureIdx++ });
        return;
      }
      // Container wrapping an iframe panel — render inline
      const children: any[] = node.children ?? [];
      const iframeChild = children.find((c: any) => c.type === 'iframe');
      if (iframeChild) {
        const heightVal = iframeChild.height ?? '400px';
        const h = typeof heightVal === 'number' ? heightVal : parseInt(String(heightVal)) || 400;
        // +100: matches MemoIframe's 8px top + 16px bottom padding + ~60px caption + 16px caption pad
        results.push({ type: 'richBlock', node, estimatedHeight: h + 100 });
        return;
      }
      // Other containers (theorem, figure, etc.) — skip
      return;
    }
    // Skip non-text node types — don't descend into them
    const SKIP_TYPES = new Set([
      'image', 'table', 'code', 'mystDirective',
      'proof', 'theorem', 'lemma', 'corollary', 'definition', 'remark',
    ]);
    if (SKIP_TYPES.has(node.type)) return;
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
  /** Minimum vertical distance between initial draggable-figure anchors. */
  minFigureAnchorSpacing = 0,
): LayoutResult {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { spans: [], richBlocks: [], figureAnchors: [], headingAnchors: [] };

  const spans: WordSpan[] = [];
  const richBlocks: PlacedRichBlock[] = [];
  const figureAnchors: FigureAnchor[] = [];
  const headingAnchors: HeadingAnchor[] = [];
  let y = startY;
  let richIdx = 0;
  let previousFigureAnchorY = Number.NEGATIVE_INFINITY;

  for (const block of blocks) {
    // ── Figure anchors (zero-height, record y position) ──────────────────────
    if (block.type === 'figureAnchor') {
      const anchorY = Math.max(y, previousFigureAnchorY + minFigureAnchorSpacing);
      figureAnchors.push({ figureIndex: block.figureIndex, y: anchorY });
      previousFigureAnchorY = anchorY;
      const inlineFigure = obstacles.find(
        (obstacle) => obstacle.inline && obstacle.figureIndex === block.figureIndex,
      );
      if (inlineFigure) {
        y = Math.max(y, anchorY + (inlineFigure.bottom - inlineFigure.top) + style.paragraphGap);
      }
      continue;
    }

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
    // Inline figures reserve their height at their own figureAnchor above.
    // Letting their absolute rectangles participate here can make a later
    // figure block earlier paragraphs and create a large blank region.
    const blockObstacles =
      block.type === 'heading' ? [] : obstacles.filter((obstacle) => !obstacle.inline);

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
      const segments = getLineSegments(
        y,
        y + blockStyle.lineHeight,
        blockObstacles,
        0,
        containerWidth,
      );
      if (segments.length === 0) {
        y = Math.max(
          y + blockStyle.lineHeight,
          nextYAfterBlockingObstacles(y, y + blockStyle.lineHeight, blockObstacles),
        );
        continue;
      }

      const wiAtLineStart = wi;
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
          });
          x += ww;
          wi++;
          placedInSegment = true;
        }
      }
      y += blockStyle.lineHeight;
      // Safety: if no words were placed this line (word too wide for every segment),
      // force-advance to prevent an infinite loop. The word is dropped from the layout.
      if (wi === wiAtLineStart) wi++;
    }

    // Vertical gap after each block
    y += block.type === 'heading'
      ? Math.round(blockStyle.lineHeight * 0.3)
      : style.paragraphGap;
  }

  return { spans, richBlocks, figureAnchors, headingAnchors };
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
