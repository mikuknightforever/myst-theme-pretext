import { LruCache } from '../lru-cache.js';
import type { StyledWord, TextStyle, ContentBlock } from './types.js';

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';

function measureWord(word: StyledWord, style: TextStyle, ctx: CanvasRenderingContext2D): number {
  if (word.measuredWidth != null && Number.isFinite(word.measuredWidth)) {
    return word.measuredWidth;
  }
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

/** Shared across layout passes and article sessions; LRU bounds retained word/font keys. */
const _widthCache = new LruCache<number>(10_000);

export function measureCached(
  word: StyledWord,
  style: TextStyle,
  ctx: CanvasRenderingContext2D,
): number {
  if (word.measuredWidth != null && Number.isFinite(word.measuredWidth)) {
    return word.measuredWidth;
  }
  const k = `${style.fontFamily}|${style.fontSize}|${word.bold ? '700' : style.fontWeight}|${word.italic ? 1 : 0}|${word.code ? 1 : 0}|${word.math ? 1 : 0}|${word.text}`;
  let v = _widthCache.get(k);
  if (v === undefined) {
    v = measureWord(word, style, ctx);
    _widthCache.set(k, v);
  }
  return v;
}

export function inlineMeasurementKey(
  word: Pick<StyledWord, 'text' | 'mathHtml' | 'semanticNode' | 'bold' | 'italic' | 'code'>,
  style: TextStyle,
): string {
  return JSON.stringify([
    style.fontFamily,
    style.fontSize,
    style.fontWeight,
    style.lineHeight,
    word.bold,
    word.italic,
    word.code,
    word.text,
    word.mathHtml,
    word.semanticNode,
  ]);
}

/** Derive TextStyle for a block (headings get larger/bolder text). */
export function styleForBlock(block: ContentBlock, base: TextStyle): TextStyle {
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
