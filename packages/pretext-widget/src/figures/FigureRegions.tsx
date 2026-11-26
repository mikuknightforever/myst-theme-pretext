import * as React from 'react';
import type { FigureRegion } from '../figure-regions.js';

/** The rendered image inside a card, in card pixels. */
export interface ImageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const sameBox = (a: ImageBox, b: ImageBox) =>
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

/** Track where the card's image is drawn: MyST renders it with `object-fit`
 * rules, so the image box (not the card) is what region fractions refer to. */
export function useImageBox(
  cardRef: React.RefObject<HTMLDivElement | null>,
  bodyRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
): ImageBox | null {
  const [box, setBox] = React.useState<ImageBox | null>(null);
  React.useLayoutEffect(() => {
    const card = cardRef.current;
    const body = bodyRef.current;
    if (!enabled || !card || !body) return;
    const measure = () => {
      const image = body.querySelector('img');
      if (!image) return;
      const cardRect = card.getBoundingClientRect();
      const rect = image.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const next = {
        left: rect.left - cardRect.left,
        top: rect.top - cardRect.top,
        width: rect.width,
        height: rect.height,
      };
      setBox((current) => (current && sameBox(current, next) ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    observer.observe(body);
    const image = body.querySelector('img');
    if (image) observer.observe(image);
    image?.addEventListener('load', measure);
    return () => {
      observer.disconnect();
      image?.removeEventListener('load', measure);
    };
  }, [cardRef, bodyRef, enabled]);
  return enabled ? box : null;
}

let maskCounter = 0;

const TRANSITION = '320ms ease';

/** Highlight the regions the current section describes and dim the rest of
 * the figure. Purely visual: pointer input stays with the card, which hit-tests
 * regions itself so dragging still works. Each region is also a focusable
 * button for keyboard readers. */
export function FigureRegionsLayer({
  regions,
  box,
  activeIds,
  hoveredId,
  sectionTitle,
  isDark,
  onZoom,
  onHover,
}: {
  regions: FigureRegion[];
  box: ImageBox;
  activeIds: ReadonlySet<string>;
  hoveredId: string | null;
  /** Title of the section being read, when it is linked to this figure. */
  sectionTitle: string | null;
  isDark: boolean;
  onZoom: (region: FigureRegion) => void;
  onHover: (id: string | null) => void;
}) {
  const maskId = React.useMemo(() => `pretext-region-mask-${(maskCounter += 1)}`, []);
  const dimmed = activeIds.size > 0;
  const rect = (region: FigureRegion) => {
    const [x0, y0, x1, y1] = region.box;
    return {
      left: x0 * box.width,
      top: y0 * box.height,
      width: (x1 - x0) * box.width,
      height: (y1 - y0) * box.height,
    };
  };
  return (
    <div
      className="pretext-figure-regions"
      data-pretext-focus={dimmed ? '' : undefined}
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <svg
        aria-hidden="true"
        width={box.width}
        height={box.height}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dimmed ? 1 : 0,
          transition: `opacity ${TRANSITION}`,
        }}
      >
        <defs>
          <mask id={maskId}>
            <rect width={box.width} height={box.height} fill="white" />
            {regions.map((region) => {
              const r = rect(region);
              return (
                <rect
                  key={region.id}
                  x={r.left}
                  y={r.top}
                  width={r.width}
                  height={r.height}
                  rx={6}
                  fill="black"
                  style={{
                    opacity: activeIds.has(region.id) ? 1 : 0,
                    transition: `opacity ${TRANSITION}`,
                  }}
                />
              );
            })}
          </mask>
        </defs>
        <rect
          width={box.width}
          height={box.height}
          fill={isDark ? 'rgba(2,6,23,0.66)' : 'rgba(15,23,42,0.52)'}
          mask={`url(#${maskId})`}
        />
      </svg>
      {regions.map((region) => {
        const r = rect(region);
        const active = activeIds.has(region.id);
        const hovered = hoveredId === region.id;
        return (
          <button
            key={region.id}
            type="button"
            className="pretext-figure-region"
            data-pretext-region={region.id}
            data-active={active ? '' : undefined}
            aria-label={`Zoom into ${region.label}`}
            aria-pressed={active}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onZoom(region);
            }}
            onFocus={() => onHover(region.id)}
            onBlur={() => onHover(null)}
            style={{
              position: 'absolute',
              ...r,
              boxSizing: 'border-box',
              margin: 0,
              padding: 0,
              background: 'transparent',
              border: `2px ${active ? 'solid' : 'dashed'} ${
                active ? '#2563eb' : isDark ? 'rgba(147,197,253,0.9)' : 'rgba(37,99,235,0.85)'
              }`,
              borderRadius: 6,
              boxShadow: active ? '0 0 0 3px rgba(37,99,235,0.28)' : 'none',
              opacity: active || hovered ? 1 : 0,
              transition: `opacity ${TRANSITION}, box-shadow ${TRANSITION}`,
              pointerEvents: 'none',
              outline: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: 3,
                // Labels of narrow regions may run past the region, not the image.
                maxWidth: Math.max(r.width - 8, Math.min(260, box.width - r.left - 12)),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '2px 8px',
                borderRadius: 999,
                background: active ? '#2563eb' : 'rgba(15,23,42,0.82)',
                color: '#ffffff',
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: '16px',
                textAlign: 'left',
              }}
            >
              {region.label}
            </span>
          </button>
        );
      })}
      <div
        aria-live="polite"
        className="pretext-figure-section"
        style={{
          position: 'absolute',
          left: 8,
          bottom: 8,
          maxWidth: 'calc(100% - 16px)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '3px 10px',
          borderRadius: 999,
          background: 'rgba(15,23,42,0.86)',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '16px',
          opacity: sectionTitle ? 1 : 0,
          transition: `opacity ${TRANSITION}`,
        }}
      >
        {sectionTitle ? `Reading § ${sectionTitle}` : ''}
      </div>
    </div>
  );
}
