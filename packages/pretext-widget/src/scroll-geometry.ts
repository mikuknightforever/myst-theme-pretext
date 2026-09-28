/** Layout coordinates start at the top of the content element, which need not
 * be the top of the scroll container (a theme header can sit above it). */
type Box = Pick<HTMLElement, 'getBoundingClientRect'>;
type ScrollBox = Box & { scrollTop: number };

/** Top of the content element in the scroll container's scroll coordinates. */
export function contentTopInScroll(scroll: ScrollBox, content: Box | null | undefined): number {
  if (!content) return 0;
  return (
    content.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop
  );
}

/** How far the content has scrolled, in layout coordinates (may be negative). */
export function contentScrollTop(scroll: ScrollBox, content: Box | null | undefined): number {
  return scroll.scrollTop - contentTopInScroll(scroll, content);
}

/** Scroll position that puts layout coordinate `y` at the top of the view. */
export function scrollTopForContentY(
  scroll: ScrollBox,
  content: Box | null | undefined,
  y: number,
): number {
  return Math.max(0, contentTopInScroll(scroll, content) + y);
}
