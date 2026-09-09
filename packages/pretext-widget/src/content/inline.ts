import type { StyledWord } from '../layout/types.js';

const SEMANTIC_INLINE_TYPES = new Set([
  'abbreviation',
  'cite',
  'citeGroup',
  'crossReference',
  'footnoteReference',
  'link',
  'subscript',
  'superscript',
  'underline',
  'delete',
  'smallcaps',
  'keyboard',
]);

/** Plain-text approximation used only to measure semantic inline nodes. */
export function semanticText(node: any): string {
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
/**
 * Recursively extract styled words from an MDAST inline node tree.
 * Handles: text, inlineCode, strong, emphasis, link, and generic parents.
 */
export function extractWords(node: any, bold = false, italic = false, code = false): StyledWord[] {
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
    return [
      {
        text: node.value as string,
        bold: false,
        italic: false,
        code: false,
        math: true,
        mathHtml: node.html as string | undefined,
      },
    ];
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
