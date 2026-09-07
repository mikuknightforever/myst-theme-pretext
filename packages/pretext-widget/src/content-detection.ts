/** Conservative, source-preserving classification of resolved MyST content.
 * A draggable card is only used when its entire body is one static image.
 * Everything more complex stays in MyST's native, measured DOM renderer. */
export function childrenOf(node: any): any[] {
  return Array.isArray(node?.children) ? node.children : [];
}

export function findNode(node: any, type: string): any | undefined {
  if (node?.type === type) return node;
  for (const child of childrenOf(node)) {
    const found = findNode(child, type);
    if (found) return found;
  }
  return undefined;
}

function plainText(node: any): string {
  return typeof node?.value === 'string' ? node.value : childrenOf(node).map(plainText).join('');
}

export function figureParts(node: any): { body: any[]; captions: any[] } {
  if (node?.type != null && node.type !== 'container' && node.type !== 'figure') {
    return { body: [node], captions: [] };
  }
  const body: any[] = [];
  const captions: any[] = [];
  for (const child of childrenOf(node)) {
    if (child.type === 'caption' || (child.type === 'legend' && !findNode(child, 'image'))) {
      captions.push(child);
    } else {
      body.push(child);
    }
  }
  return { body, captions };
}

/** Do not invent sequential numbering: interactive figures may occupy numbers
 * between static figures, and appendices may use identifiers such as A.2. */
export function figureLabel(node: any): string {
  const { captions } = figureParts(node);
  const number = captions.map((caption) => findNode(caption, 'captionNumber')).find(Boolean);
  if (number) {
    const rendered = plainText(number)
      .replace(/[\s:：]+$/u, '')
      .trim();
    if (rendered) return rendered;
    if (number.enumerator != null) return `Figure ${number.enumerator}`;
  }
  if (node?.enumerator != null) return `Figure ${node.enumerator}`;
  return node?.type === 'container' || node?.type === 'figure' ? 'Figure' : 'Image';
}

function staticImageCount(node: any): number | null {
  if (node?.type === 'image') return 1;
  if (node?.type === 'text') return String(node.value ?? '').trim() ? null : 0;
  // Links, widgets, HTML, arbitrary extensions and nested figures are not
  // static wrappers: putting them in a drag surface would intercept input.
  if (!['paragraph', 'span', 'legend'].includes(node?.type)) return null;
  let count = 0;
  for (const child of childrenOf(node)) {
    const childCount = staticImageCount(child);
    if (childCount == null) return null;
    count += childCount;
  }
  return count;
}

export function isStaticFigure(node: any, selector = 'pretext-draggable'): boolean {
  const className = selector.replace(/^\./, '');
  const marked = String(node?.class ?? node?.className ?? '')
    .split(/\s+/)
    .includes(className);
  const candidate =
    node?.type === 'image' ||
    node?.type === 'paragraph' ||
    node?.type === 'figure' ||
    (node?.type === 'container' && (node.kind === 'figure' || marked));
  if (!candidate || (node?.type === 'container' && node.kind === 'table')) return false;
  const { body, captions } = figureParts(node);
  // Interactive captions must retain their normal DOM events too.
  if (captions.some((caption) => containsInteractiveContent(caption))) return false;
  let count = 0;
  for (const part of body) {
    const partCount = staticImageCount(part);
    if (partCount == null) return false;
    count += partCount;
  }
  return count === 1;
}

const STATIC_CAPTION_TYPES = new Set([
  'caption',
  'legend',
  'paragraph',
  'captionNumber',
  'text',
  'strong',
  'emphasis',
  'span',
  'inlineMath',
  'math',
  'inlineCode',
  'cite',
  'citeGroup',
  'abbreviation',
  'crossReference',
  'footnoteReference',
  'link',
  'subscript',
  'superscript',
  'underline',
  'delete',
  'smallcaps',
  'keyboard',
  'break',
]);

function containsInteractiveContent(node: any): boolean {
  if (!STATIC_CAPTION_TYPES.has(node?.type)) return true;
  return childrenOf(node).some(containsInteractiveContent);
}

const INLINE_TYPES = new Set([
  'text',
  'inlineCode',
  'inlineMath',
  'strong',
  'emphasis',
  'span',
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

/** Unknown inline nodes, hard breaks and inline images are kept in their whole
 * native paragraph instead of being flattened into incomplete canvas text. */
export function canExtractInline(node: any): boolean {
  return INLINE_TYPES.has(node?.type) && childrenOf(node).every(canExtractInline);
}

export function isSimpleList(node: any): boolean {
  return (
    !node.ordered &&
    childrenOf(node).every(
      (item) =>
        item.type === 'listItem' &&
        item.checked == null &&
        childrenOf(item).length === 1 &&
        childrenOf(item)[0].type === 'paragraph' &&
        childrenOf(childrenOf(item)[0]).every(canExtractInline),
    )
  );
}

/** Only this exact simple shape may use the existing iframe presentation.
 * Extra siblings, nested widgets or multiple iframes must not be discarded. */
export function simpleIframe(node: any): any | undefined {
  if (node?.type === 'iframe') return node;
  const children = childrenOf(node);
  if (node?.type !== 'container' || children.some((c) => !['iframe', 'caption'].includes(c.type))) {
    return undefined;
  }
  const frames = children.filter((c) => c.type === 'iframe');
  return frames.length === 1 ? frames[0] : undefined;
}

export function unsupportedTypes(node: any, renderers: Record<string, unknown>): string[] {
  const missing = new Set<string>();
  const walk = (current: any) => {
    if (!current?.type) return;
    if (!renderers[current.type]) missing.add(current.type);
    childrenOf(current).forEach(walk);
  };
  walk(node);
  return [...missing];
}

/** MyST intentionally suppresses footnoteDefinition in normal article flow;
 * its separate footer renders it there. Pretext owns a separate flow, so it
 * must provide that visible wrapper itself rather than render an empty node. */
export function nativeBlockNode(node: any): any {
  if (node?.type !== 'footnoteDefinition') return node;
  return {
    type: 'div',
    key: node.key,
    html_id: `fn-${node.identifier}`,
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'strong',
            children: [
              {
                type: 'text',
                value: `[${node.enumerator ?? node.number ?? node.identifier}]`,
              },
            ],
          },
        ],
      },
      ...childrenOf(node),
    ],
  };
}
