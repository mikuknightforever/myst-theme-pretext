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
 * Return the horizontal segments available on a line at `lineCenterY`,
 * avoiding the obstacle rect.
 */
function getLineSegments(
  lineCenterY: number,
  obstacle: ObstacleRect,
  leftEdge: number,
  rightEdge: number,
  gap = 20,
): Array<[number, number]> {
  const hits = lineCenterY >= obstacle.top && lineCenterY <= obstacle.bottom;
  if (!hits) return [[leftEdge, rightEdge]];

  const segments: Array<[number, number]> = [];
  if (obstacle.left - gap > leftEdge) segments.push([leftEdge, obstacle.left - gap]);
  if (obstacle.right + gap < rightEdge) segments.push([obstacle.right + gap, rightEdge]);
  return segments.filter(([s, e]) => e - s > 60);
}

/**
 * Layout an array of paragraph text strings into positioned word spans,
 * reflowing around the given obstacle rect.
 *
 * Returns the array of WordSpan objects to render.
 */
export function layoutParagraphs(
  paragraphs: string[],
  obstacle: ObstacleRect,
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
      const lineCenterY = y + style.lineHeight / 2;
      const segments = getLineSegments(lineCenterY, obstacle, 0, containerWidth);

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
      return; // don't recurse into paragraph children further
    }
    if (node.children) {
      for (const child of node.children as any[]) walk(child);
    }
  }
  walk(mdast);
  return results;
}

/**
 * Walk an MDAST tree and find the first node whose `class` attribute
 * contains `selector` (e.g. 'pretext-draggable').
 */
export function findDraggableNode(mdast: any, selector: string): any | null {
  function walk(node: any): any | null {
    if (!node) return null;
    const cls: string = node.class ?? node.className ?? '';
    if (cls.split(/\s+/).includes(selector)) return node;
    if (node.children) {
      for (const child of node.children as any[]) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(mdast);
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
