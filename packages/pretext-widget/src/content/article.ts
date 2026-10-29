import {
  canExtractInline,
  childrenOf,
  figureLabel,
  isInteractiveOutputFigure,
  isStaticFigure,
} from '../content-detection.js';
import type { FigureInfo } from '../model.js';
import type { ContentBlock, StyledWord } from '../layout/types.js';
import { semanticText, extractWords } from './inline.js';

export function isAbstractHeading(node: any): boolean {
  return node?.type === 'heading' && semanticText(node).trim().toLowerCase() === 'abstract';
}

/** The abstract as MyST marks it in the page body: a block with part: abstract. */
export function isAbstractPart(node: any): boolean {
  return node?.type === 'block' && node.data?.part === 'abstract';
}

function containsAbstract(node: any): boolean {
  return isAbstractHeading(node) || isAbstractPart(node) || childrenOf(node).some(containsAbstract);
}

function keywordsParagraph(keywords: unknown): any | undefined {
  if (!Array.isArray(keywords) || keywords.length === 0) return undefined;
  return {
    type: 'paragraph',
    children: [
      { type: 'strong', children: [{ type: 'text', value: 'Keywords:' }] },
      { type: 'text', value: ` ${keywords.join(', ')}` },
    ],
  };
}

/** Show the abstract as the article page does: under an "Abstract" heading, in
 * a shaded box, followed by the keywords. Articles whose abstract lives only in
 * front matter (`parts.abstract`) would otherwise lose it, so it is put first.
 * Returns the same tree when there is nothing to add; never mutates it. */
export function withFrontmatterAbstract(mdast: any, frontmatter: any): any {
  if (!mdast) return mdast;
  const keywords = keywordsParagraph(frontmatter?.keywords);
  const abstract = frontmatter?.parts?.abstract?.mdast;
  const top = childrenOf(mdast);
  const partIndex = top.findIndex(isAbstractPart);
  if (partIndex >= 0) {
    if (!keywords) return mdast;
    const children = [...top];
    children.splice(partIndex + 1, 0, keywords);
    return { ...mdast, children };
  }
  if (!abstract || containsAbstract(mdast)) return mdast;
  return {
    ...mdast,
    children: [
      {
        type: 'block',
        data: { part: 'abstract' },
        children: abstract.type === 'root' ? childrenOf(abstract) : [abstract],
      },
      ...(keywords ? [keywords] : []),
      ...top,
    ],
  };
}

/** Inline content written straight into a list item (a "tight" list) joins the
 * paragraph that follows it, or becomes one, so it is drawn as text too. */
function listItemParts(item: any): any[] {
  const parts: any[] = [];
  let run: any[] = [];
  for (const child of childrenOf(item)) {
    if (canExtractInline(child) || child.type === 'image' || child.type === 'break') {
      run.push(child);
      continue;
    }
    if (run.length && child.type === 'paragraph') {
      parts.push({ ...child, children: [...run, ...childrenOf(child)] });
    } else {
      if (run.length) parts.push({ type: 'paragraph', children: run });
      parts.push(child);
    }
    run = [];
  }
  if (run.length) parts.push({ type: 'paragraph', children: run });
  return parts;
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
  /** Set while walking the abstract, whose text is drawn in a shaded box. */
  let panel: 'abstract' | undefined;
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
    // A hard line break between blocks (a paragraph's own breaks stay in it)
    // only adds a blank line in the article; in columns it is an empty gap.
    if (node.type === 'break') return;
    if (isStaticFigure(node, options.draggableSelector)) {
      results.push({ type: 'figureAnchor', figureIndex: figures.length });
      figures.push({ mdastNode: node, label: figureLabel(node), imageUrl: findImageUrl(node) });
      return;
    }
    if (isInteractiveOutputFigure(node)) {
      results.push({ type: 'figureAnchor', figureIndex: figures.length });
      figures.push({
        mdastNode: node,
        label: figureLabel(node),
        imageUrl: null,
        interactive: true,
      });
      return;
    }
    if (node.type === 'paragraph') {
      if (!childrenOf(node).every(canExtractInline)) {
        pushRichBlock(node, 100);
        return;
      }
      const words = (node.children ?? []).flatMap((c: any) => extractWords(c));
      if (words.length > 0) results.push({ type: 'paragraph', words, ...(panel && { panel }) });
      return;
    }
    if (isAbstractPart(node)) {
      if (!childrenOf(node).some(isAbstractHeading)) {
        results.push({
          type: 'heading',
          depth: 2,
          words: [{ text: 'Abstract', bold: true, italic: false, code: false }],
          headingId: 'abstract',
          headingTitle: 'Abstract',
        });
      }
      panel = 'abstract';
      childrenOf(node).forEach(walk);
      panel = undefined;
      return;
    }
    if (node.type === 'heading') {
      if (!childrenOf(node).every(canExtractInline)) {
        pushRichBlock(node, 70);
        return;
      }
      const plainTitle = semanticText(node).trim() || 'Untitled section';
      // The article shows its abstract unnumbered (as a front-matter part), so
      // Pretext drops that one section number too; later numbers are unchanged.
      const enumerator = isAbstractHeading(node) ? undefined : node.enumerator;
      const title = enumerator ? `${enumerator} ${plainTitle}` : plainTitle;
      const requestedId = String(
        node.html_id ?? node.identifier ?? node.label ?? slugifyHeading(plainTitle),
      ).replace(/^#/, '');
      const seen = headingIds.get(requestedId) ?? 0;
      headingIds.set(requestedId, seen + 1);
      const headingId = seen === 0 ? requestedId : `${requestedId}-${seen + 1}`;
      const enumWord: StyledWord[] = enumerator
        ? [
            {
              text: String(enumerator),
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
    if (node.type === 'list') {
      walkList(node, 0);
      return;
    }
    if (node.type === 'listItem') {
      walkList({ type: 'list', children: [node] }, 0);
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
    if (['root', 'block', 'section', 'include', 'admonition'].includes(node.type)) {
      childrenOf(node).forEach(walk);
      return;
    }
    // Let MyST render other content (footnotes, definition lists, tabs,
    // widgets, unresolved directives, etc.). Never silently skip unknown leaves.
    pushRichBlock(node, 100);
  }
  /** Every list item is drawn as text (so the reader's effects reach it): its
   * marker, numbering and nesting are kept, later paragraphs of an item line up
   * past the marker, and anything that is not text (code, images, tables) is
   * placed in order between them as usual. */
  function walkList(list: any, depth: number) {
    const start = typeof list.start === 'number' ? list.start : 1;
    childrenOf(list).forEach((item, i) => {
      if (item.type !== 'listItem') {
        walk(item);
        return;
      }
      const marker =
        item.checked != null ? (item.checked ? '☑' : '☐') : list.ordered ? `${start + i}.` : '•';
      let first = true;
      for (const part of listItemParts(item)) {
        if (part.type === 'list') {
          walkList(part, depth + 1);
        } else if (part.type === 'paragraph' && childrenOf(part).every(canExtractInline)) {
          const words = childrenOf(part).flatMap((c: any) => extractWords(c));
          if (words.length === 0) continue;
          results.push({
            type: 'listItem',
            bullet: first,
            marker,
            depth,
            words,
            ...(panel && { panel }),
          });
        } else if (part.type === 'paragraph') {
          // An image in a list belongs to the list, not a movable figure card.
          pushRichBlock(part, 100);
        } else {
          walk(part);
        }
        first = false;
      }
    });
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
