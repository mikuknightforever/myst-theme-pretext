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

/** Widths are kept with each word, per font (pretext's "prepare once"): later
 * layout passes are arithmetic over these numbers, with no key building or cache
 * bookkeeping per word. A word usually has one or two fonts (body, heading). */
const wordWidths = new WeakMap<StyledWord, Array<{ font: string; width: number }>>();

const fontKeys = new WeakMap<TextStyle, string>();
/** Identifies a style's font; built once per style object, not once per word. */
export function fontKeyOf(style: TextStyle): string {
  let key = fontKeys.get(style);
  if (key === undefined) {
    key = `${style.fontFamily}|${style.fontSize}|${style.fontWeight}`;
    fontKeys.set(style, key);
  }
  return key;
}

export function measureCached(
  word: StyledWord,
  style: TextStyle,
  ctx: CanvasRenderingContext2D,
  font: string = fontKeyOf(style),
): number {
  if (word.measuredWidth != null && Number.isFinite(word.measuredWidth)) {
    return word.measuredWidth;
  }
  let entries = wordWidths.get(word);
  if (entries) {
    for (let i = 0; i < entries.length; i++) if (entries[i].font === font) return entries[i].width;
  } else {
    entries = [];
    wordWidths.set(word, entries);
  }
  const width = measureWord(word, style, ctx);
  // Keep the few most recent fonts (e.g. while dragging the font-size slider).
  if (entries.length >= 4) entries.shift();
  entries.push({ font, width });
  return width;
}

export function inlineMeasurementKey(
  word: Pick<StyledWord, 'text' | 'mathHtml' | 'semanticNode' | 'bold' | 'italic' | 'code'>,
  style: TextStyle,
): string {
  return JSON.stringify([
    style.fontFamily,
    style.fontSize,
    style.fontWeight,
    // Line height is left out on purpose: tokens are measured at their natural
    // height and layout takes the larger of that and the line height.
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
