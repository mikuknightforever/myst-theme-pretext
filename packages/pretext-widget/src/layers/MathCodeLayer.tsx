import * as React from 'react';
import { MyST } from 'myst-to-react';
import type { WordSpan } from '../layout.js';

const CODE_FONT = 'ui-monospace, "Courier New", Courier, monospace';
const VIEWPORT_BUFFER = 500;

/** DOM layer for code, math, links, citations and cross references. */
export function MathCodeLayer({
  spans,
  scrollContainerRef,
  isDark,
}: {
  spans: WordSpan[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef]);

  const viewH = scrollContainerRef.current?.clientHeight ?? 600;
  const yMin = scrollTop - VIEWPORT_BUFFER;
  const yMax = scrollTop + viewH + VIEWPORT_BUFFER;

  const visible = React.useMemo(() => {
    const out: Array<{ s: WordSpan; idx: number }> = [];
    for (let i = 0; i < spans.length; i++) {
      const s = spans[i];
      if ((s.code || s.math || s.semanticNode) && s.y >= yMin && s.y <= yMax) {
        out.push({ s, idx: i });
      }
    }
    return out;
  }, [spans, yMin, yMax]);

  if (visible.length === 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {visible.map(({ s, idx }) => (
        <span
          key={idx}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            fontSize: s.style.fontSize,
            lineHeight: `${s.style.lineHeight}px`,
            fontFamily: s.code ? CODE_FONT : s.style.fontFamily,
            fontWeight: s.bold ? '700' : s.style.fontWeight,
            fontStyle: s.italic ? 'italic' : 'normal',
            color: isDark ? '#e5e7eb' : s.style.color,
            whiteSpace: 'nowrap',
            pointerEvents: s.semanticNode ? 'auto' : 'none',
            ...(s.code && {
              background: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)',
              borderRadius: 3,
              padding: '1px 3px',
            }),
          }}
        >
          {s.semanticNode ? (
            <MyST ast={[s.semanticNode]} />
          ) : s.math && s.mathHtml ? (
            <span dangerouslySetInnerHTML={{ __html: s.mathHtml }} />
          ) : (
            s.text
          )}
        </span>
      ))}
    </div>
  );
}
