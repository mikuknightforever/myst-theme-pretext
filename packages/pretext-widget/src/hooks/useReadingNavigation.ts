import * as React from 'react';
import type { HeadingAnchor } from '../layout/types.js';

/** Keep the reading position and scope local references to this overlay. */
export function useReadingNavigation({
  headingAnchors,
  contentRef,
  scrollRef,
}: {
  headingAnchors: HeadingAnchor[];
  contentRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pendingLayoutHeadingRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const pendingHeadingId = pendingLayoutHeadingRef.current;
    const scrollContainer = scrollRef.current;
    if (!pendingHeadingId || !scrollContainer) return;
    const target = headingAnchors.find((heading) => heading.id === pendingHeadingId);
    if (!target) return;
    scrollContainer.scrollTop = Math.max(0, target.y - 16);
    pendingLayoutHeadingRef.current = null;
  }, [headingAnchors]);
  function rememberReadingPosition() {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    let activeHeading: HeadingAnchor | undefined;
    for (const heading of headingAnchors) {
      if (heading.y <= scrollTop + 80) activeHeading = heading;
      else break;
    }
    pendingLayoutHeadingRef.current = activeHeading?.id ?? null;
  }
  function followLocalReference(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const link = (event.target as Element).closest?.('a[href]');
    const content = contentRef.current;
    const scroll = scrollRef.current;
    if (!link || !content || !scroll || link.getAttribute('target') === '_blank') return;
    const url = new URL(link.getAttribute('href')!, window.location.href);
    if (
      url.origin !== window.location.origin ||
      url.pathname !== window.location.pathname ||
      !url.hash
    )
      return;
    let id: string;
    try {
      id = decodeURIComponent(url.hash.slice(1));
    } catch {
      return;
    }
    const target = Array.from(content.querySelectorAll<HTMLElement>('[id]')).find(
      (node) => node.id === id,
    );
    const heading = headingAnchors.find((anchor) => anchor.id === id);
    if (!target && !heading) return;
    // The original article is still mounted behind the overlay. Scope links to
    // this reading surface instead of document.getElementById's first match.
    event.preventDefault();
    event.stopPropagation();
    const y = target
      ? target.getBoundingClientRect().top - content.getBoundingClientRect().top
      : heading!.y;
    scroll.scrollTop = Math.max(0, y - 16);
  }

  return { rememberReadingPosition, followLocalReference };
}
