import * as React from 'react';
import { contentScrollTop } from '../scroll-geometry.js';
import type { HeadingAnchor } from '../layout/types.js';

/** The last heading at or above a reading marker, which sits `markerOffset`
 * pixels below the top of the view. Updates at most once per frame. */
export function activeHeadingAt(headings: HeadingAnchor[], marker: number): string | null {
  let active: string | null = null;
  for (const heading of headings) {
    if (heading.y > marker) break;
    active = heading.id;
  }
  return active;
}

export function useActiveHeading(
  headings: HeadingAnchor[],
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null> | undefined,
  markerOffset: (viewHeight: number) => number,
  /** Heading reported before the reader has scrolled past any heading. */
  fallback: 'first' | 'none' = 'first',
): string | null {
  const [activeId, setActiveId] = React.useState<string | null>(
    fallback === 'first' ? (headings[0]?.id ?? null) : null,
  );
  const offsetRef = React.useRef(markerOffset);
  offsetRef.current = markerOffset;
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) {
      setActiveId(null);
      return;
    }
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const marker =
        contentScrollTop(container, contentRef?.current) +
        offsetRef.current(container.clientHeight);
      const next =
        activeHeadingAt(headings, marker) ?? (fallback === 'first' ? headings[0].id : null);
      setActiveId((current) => (current === next ? current : next));
    };
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(update);
    };
    update();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [headings, scrollContainerRef, contentRef, fallback]);
  return activeId;
}
