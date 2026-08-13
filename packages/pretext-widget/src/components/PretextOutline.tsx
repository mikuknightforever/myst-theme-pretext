import * as React from 'react';
import type { HeadingAnchor } from '../layout.js';

export function PretextOutline({
  headings,
  scrollContainerRef,
  isDark,
}: {
  headings: HeadingAnchor[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const [activeId, setActiveId] = React.useState(headings[0]?.id ?? '');

  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;
    let rafId: number | null = null;
    const update = () => {
      rafId = null;
      const marker = container.scrollTop + 120;
      let next = headings[0].id;
      for (const heading of headings) {
        if (heading.y > marker) break;
        next = heading.id;
      }
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
  }, [headings, scrollContainerRef]);

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
                  scrollContainerRef.current?.scrollTo({
                    top: Math.max(0, heading.y - 24),
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
                  color: active ? (isDark ? '#93c5fd' : '#1d4ed8') : isDark ? '#cbd5e1' : '#475569',
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
