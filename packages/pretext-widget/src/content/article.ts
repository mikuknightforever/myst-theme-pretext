import {
  canExtractInline,
  childrenOf,
  figureLabel,
  isSimpleList,
  isStaticFigure,
} from '../content-detection.js';
import type { FigureInfo } from '../model.js';
import type { ContentBlock, StyledWord } from '../layout/types.js';
import { semanticText, extractWords } from './inline.js';

function slugifyHeading(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * Walk an MDAST tree and collect content blocks:
 * paragraphs, headings, and list items — with inline formatting preserved.
 */
export interface ArticleContent {
  blocks: ContentBlock[];
  figures: FigureInfo[];
}

/** One traversal assigns both anchors and cards, so automatic and legacy
 * figures cannot disagree about indexes. The source AST is never mutated. */
export function collectArticle(
  mdast: any,
  options: { draggableSelector?: string } = {},
): ArticleContent {
  const results: ContentBlock[] = [];
  const figures: FigureInfo[] = [];
  let richBlockIdx = 0;
  const headingIds = new Map<string, number>();
  const pushRichBlock = (node: any, estimatedHeight: number) => {
    results.push({
      type: 'richBlock',
      node,
      estimatedHeight,
      richBlockIndex: richBlockIdx++,
    });
  };
  function walk(node: any) {
    if (!node) return;
    if (['pretext-widget', 'comment', 'mystComment', 'definition'].includes(node.type)) return;
    if (isStaticFigure(node, options.draggableSelector)) {
      results.push({ type: 'figureAnchor', figureIndex: figures.length });
      figures.push({ mdastNode: node, label: figureLabel(node), imageUrl: findImageUrl(node) });
      return;
    }
    if (node.type === 'paragraph') {
      if (!childrenOf(node).every(canExtractInline)) {
        pushRichBlock(node, 100);
        return;
      }
      const words = (node.children ?? []).flatMap((c: any) => extractWords(c));
      if (words.length > 0) results.push({ type: 'paragraph', words });
      return;
    }
    if (node.type === 'heading') {
      if (!childrenOf(node).every(canExtractInline)) {
        pushRichBlock(node, 70);
        return;
      }
      const plainTitle = semanticText(node).trim() || 'Untitled section';
      const title = node.enumerator ? `${node.enumerator} ${plainTitle}` : plainTitle;
      const requestedId = String(
        node.html_id ?? node.identifier ?? node.label ?? slugifyHeading(plainTitle),
      ).replace(/^#/, '');
      const seen = headingIds.get(requestedId) ?? 0;
      headingIds.set(requestedId, seen + 1);
      const headingId = seen === 0 ? requestedId : `${requestedId}-${seen + 1}`;
      const enumWord: StyledWord[] = node.enumerator
        ? [
            {
              text: String(node.enumerator),
              bold: true,
              italic: false,
              code: false,
              spaceAfter: true,
            },
          ]
        : [];
      const words = [
        ...enumWord,
        ...(node.children ?? []).flatMap((c: any) => extractWords(c, true)),
      ];
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
    if (node.type === 'list' && !isSimpleList(node)) {
      // Preserve numbering, nesting, task checkboxes, images and multiple
      // paragraphs rather than flattening all of them into one bullet.
      pushRichBlock(node, Math.max(100, childrenOf(node).length * 48));
      return;
    }
    if (node.type === 'listItem') {
      if (!isSimpleList({ children: [node] })) {
        pushRichBlock(node, 100);
        return;
      }
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
      // Source formatting newlines do not create rendered equation lines. Only
      // explicit TeX line breaks should affect the initial estimate; the DOM
      // layer reports the exact rendered height after the first paint.
      const explicitLines = String(node.value ?? '').split(/\\\\(?:\[[^\]]*\])?/).length;
      const estimatedHeight = Math.max(72, explicitLines * 38 + 32);
      pushRichBlock(node, estimatedHeight);
      return;
    }
    if (node.type === 'iframe') {
      const heightVal = node.height ?? '400px';
      const h = typeof heightVal === 'number' ? heightVal : parseInt(String(heightVal)) || 400;
      // +100: 24px top/bottom padding + ~60px caption + 16px caption padding
      pushRichBlock(node, h + 100);
      return;
    }
    if (node.type === 'table') {
      const rowCount = (node.children ?? []).filter(
        (child: any) => child.type === 'tableRow',
      ).length;
      pushRichBlock(node, Math.max(100, rowCount * 42 + 32));
      return;
    }
    if (node.type === 'code') {
      const lineCount = Math.max(1, String(node.value ?? '').split('\n').length);
      pushRichBlock(node, Math.max(72, lineCount * 22 + 32));
      return;
    }
    if (node.type === 'container') {
      // Container wrapping an iframe panel — render inline
      const children: any[] = node.children ?? [];
      const iframeChild = children.find((c: any) => c.type === 'iframe');
      if (iframeChild) {
        const heightVal = iframeChild.height ?? '400px';
        const h = typeof heightVal === 'number' ? heightVal : parseInt(String(heightVal)) || 400;
        // +100: matches MemoIframe's 8px top + 16px bottom padding + ~60px caption + 16px caption pad
        pushRichBlock(node, h + 100);
        return;
      }
      // Tables need their caption and body to remain one measured, scrollable
      // unit. Other structural containers are flattened into the paper flow so
      // long proofs/admonitions can split naturally between columns.
      if (node.kind === 'table' || children.some((child: any) => child.type === 'table')) {
        const table = children.find((child: any) => child.type === 'table');
        const rowCount = (table?.children ?? []).filter(
          (child: any) => child.type === 'tableRow',
        ).length;
        pushRichBlock(node, Math.max(120, rowCount * 42 + 72));
        return;
      }
      if (node.kind === 'figure' || children.some((child) => child.type === 'caption')) {
        // Compound, linked or interactive figures retain their entire native
        // subtree, including all images, controls, legends and captions.
        pushRichBlock(node, 300);
        return;
      }
      for (const child of children) walk(child);
      return;
    }
    if (node.type === 'admonitionTitle') {
      const words = (node.children ?? []).flatMap((child: any) => extractWords(child, true));
      if (words.length > 0) results.push({ type: 'paragraph', words });
      return;
    }
    if (['root', 'block', 'section', 'include', 'admonition', 'list'].includes(node.type)) {
      childrenOf(node).forEach(walk);
      return;
    }
    // Let MyST render other content (footnotes, definition lists, tabs,
    // widgets, unresolved directives, etc.). Never silently skip unknown leaves.
    pushRichBlock(node, 100);
  }
  walk(mdast);
  return { blocks: results, figures };
}

/** Compatibility helper for layout-only consumers. */
export function collectBlocks(mdast: any): ContentBlock[] {
  return collectArticle(mdast).blocks;
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
