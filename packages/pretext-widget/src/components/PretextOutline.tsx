import * as React from 'react';
import { DARK } from './palette.js';
import { scrollTopForContentY } from '../scroll-geometry.js';
import type { HeadingAnchor } from '../layout.js';
import { useActiveHeading } from '../hooks/useActiveHeading.js';

const outlineMarker = () => 120;

export function PretextOutline({
  headings,
  scrollContainerRef,
  contentRef,
  isDark,
}: {
  headings: HeadingAnchor[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Heading positions are relative to this element, not the scroll container. */
  contentRef?: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const activeId = useActiveHeading(headings, scrollContainerRef, contentRef, outlineMarker);

  if (headings.length === 0) return null;
  const minDepth = Math.min(...headings.map((heading) => heading.depth));

  return (
    <nav aria-label="Pretext document outline">
      <div
        style={{
          marginBottom: 12,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isDark ? '#94a3b8' : '#64748b',
        }}
      >
        On this page
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id} style={{ margin: '2px 0' }}>
              <button
                type="button"
                aria-current={active ? 'location' : undefined}
                onClick={() => {
                  const container = scrollContainerRef.current;
                  container?.scrollTo({
                    top: scrollTopForContentY(container, contentRef?.current, heading.y - 24),
                    behavior: 'smooth',
                  });
                }}
                style={{
                  width: '100%',
                  border: 0,
                  borderLeft: `3px solid ${active ? '#2563eb' : 'transparent'}`,
                  borderRadius: '0 7px 7px 0',
                  padding: `7px 8px 7px ${8 + (heading.depth - minDepth) * 12}px`,
                  background: active
                    ? isDark
                      ? 'rgba(96,165,250,0.18)'
                      : 'rgba(37,99,235,0.09)'
                    : 'transparent',
                  color: active
                    ? isDark
                      ? '#93c5fd'
                      : '#1d4ed8'
                    : isDark
                      ? DARK.muted
                      : '#475569',
                  fontFamily:
                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  lineHeight: 1.35,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                {heading.title}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
