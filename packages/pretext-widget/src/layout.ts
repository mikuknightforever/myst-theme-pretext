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

export interface WordSpan {
  text: string;
  x: number;
  y: number;
  style: TextStyle;
}

/** Measure word width using an offscreen canvas. */
function measureWord(word: string, style: TextStyle, ctx: CanvasRenderingContext2D): number {
  ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
  return ctx.measureText(word).width;
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
 * Layout an array of paragraph text strings into positioned word spans,
 * reflowing around all obstacle rects.
 *
 * Returns the array of WordSpan objects to render.
 */
export function layoutParagraphs(
  paragraphs: string[],
  obstacles: ObstacleRect[],
  containerWidth: number,
  startY: number,
  style: TextStyle,
): WordSpan[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  const spans: WordSpan[] = [];

  let y = startY;
  for (const para of paragraphs) {
    const words = para
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean);
    let wi = 0;

    while (wi < words.length) {
      const segments = getLineSegments(y, y + style.lineHeight, obstacles, 0, containerWidth);

      for (const [segStart, segEnd] of segments) {
        let x = segStart;
        while (wi < words.length) {
          const word = words[wi];
          const ww = measureWord(word, style, ctx);
          if (x + ww > segEnd) break;
          spans.push({ text: word, x, y, style });
          x += ww + 6;
          wi++;
        }
      }
      y += style.lineHeight;
    }
    y += style.paragraphGap;
  }

  return spans;
}

/**
 * Extract plain text from an MDAST node tree.
 * Handles `text`, `inlineCode`, and recursively walks `children`.
 */
export function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.children) {
    return (node.children as any[]).map(extractTextFromNode).join('');
  }
  return '';
}

/**
 * Walk an MDAST tree and collect top-level paragraph text strings.
 */
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

/**
 * Walk an MDAST tree and return ALL nodes whose `class` attribute
 * contains `selector` (e.g. 'pretext-draggable').
 */
export function findAllDraggableNodes(mdast: any, selector: string): any[] {
  const results: any[] = [];
  function walk(node: any) {
    if (!node) return;
    const cls: string = node.class ?? node.className ?? '';
    if (cls.split(/\s+/).includes(selector)) {
      results.push(node);
      return; // don't recurse into a matched node
    }
    if (node.children) {
      for (const child of node.children as any[]) walk(child);
    }
  }
  walk(mdast);
  return results;
}

/**
 * Try to find an image URL inside an MDAST figure/container node.
 */
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
