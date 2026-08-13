import * as React from 'react';
import { MyST } from 'myst-to-react';
import type { PlacedRichBlock } from '../layout.js';

const VIEWPORT_BUFFER = 500;

const MemoEquation = React.memo(function MemoEquation({ node }: { node: any }) {
  return <MyST ast={[node]} />;
});

const MemoIframe = React.memo(function MemoIframe({
  src,
  iframeHeight,
  captionChildren,
}: {
  src: string;
  iframeHeight: number;
  captionChildren: any[];
}) {
  return (
    <div style={{ padding: '8px 0 16px' }}>
      <iframe
        src={src}
        style={{
          width: '100%',
          height: iframeHeight,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 6,
          display: 'block',
        }}
        title=""
      />
      {captionChildren.length > 0 && (
        <div style={{ fontSize: 13, lineHeight: 1.5, color: '#64748b', paddingTop: 8 }}>
          <MyST ast={captionChildren} />
        </div>
      )}
    </div>
  );
});

/** Block math and interactive iframe layer. */
export function RichBlockLayer({
  richBlocks,
  scrollContainerRef,
}: {
  richBlocks: PlacedRichBlock[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {richBlocks.map((block, i) => {
        const isIframe =
          block.node?.type === 'iframe' ||
          (block.node?.children ?? []).some((c: any) => c.type === 'iframe');
        if (!isIframe && (block.y + block.estimatedHeight < yMin || block.y > yMax)) return null;

        if (isIframe) {
          const iframeNode =
            block.node?.type === 'iframe'
              ? block.node
              : ((block.node?.children ?? []).find((c: any) => c.type === 'iframe') ?? block.node);
          const captionNode =
            block.node?.type === 'container'
              ? (block.node.children ?? []).find((c: any) => c.type === 'caption')
              : null;
          const ih =
            typeof iframeNode.height === 'number'
              ? iframeNode.height
              : parseInt(String(iframeNode.height ?? '400')) || 400;
          const src = iframeNode.src ?? iframeNode.url ?? iframeNode.value ?? '';
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: block.y,
                width: '100%',
                boxSizing: 'border-box',
                pointerEvents: 'auto',
              }}
            >
              <MemoIframe
                src={src}
                iframeHeight={ih}
                captionChildren={captionNode?.children ?? []}
              />
            </div>
          );
        }

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: block.y,
              width: '100%',
              boxSizing: 'border-box',
              minHeight: block.estimatedHeight,
            }}
          >
            <MemoEquation node={block.node} />
          </div>
        );
      })}
    </div>
  );
}
