import * as React from 'react';
import { MyST } from 'myst-to-react';
import { useNodeRenderers, useThemeSwitcher } from '@myst-theme/providers';
import { DARK } from '../components/palette.js';
import { nativeBlockNode, simpleIframe, unsupportedTypes } from '../content-detection.js';
import type { PlacedRichBlock, TextStyle } from '../layout.js';

function useMeasuredBlockHeight(
  ref: React.RefObject<HTMLDivElement | null>,
  richBlockIndex: number,
  onHeightChange?: (richBlockIndex: number, height: number) => void,
) {
  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !onHeightChange) return;

    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // offsetHeight includes the horizontal scrollbar, so following text
        // can never be painted underneath it.
        onHeightChange(richBlockIndex, Math.ceil(element.offsetHeight));
      });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [onHeightChange, ref, richBlockIndex]);
}

function MeasuredRichBlock({
  block,
  children,
  onHeightChange,
}: {
  block: PlacedRichBlock;
  children: React.ReactNode;
  onHeightChange?: (richBlockIndex: number, height: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  useMeasuredBlockHeight(ref, block.richBlockIndex, onHeightChange);
  return (
    <div
      ref={ref}
      className="pretext-rich-block"
      data-pretext-rich-index={block.richBlockIndex}
      data-pretext-block-kind={block.node?.type}
      style={{
        position: 'absolute',
        left: block.x,
        top: block.y,
        width: block.width,
        boxSizing: 'border-box',
        display: 'flow-root',
        pointerEvents: 'auto',
        overflowX: 'auto',
        overflowY: 'hidden',
        overscrollBehaviorX: 'contain',
        touchAction: 'pan-x',
      }}
    >
      {children}
    </div>
  );
}

const MemoNativeBlock = React.memo(function MemoNativeBlock({ node }: { node: any }) {
  const renderers = useNodeRenderers();
  const visibleNode = React.useMemo(() => nativeBlockNode(node), [node]);
  const missing = unsupportedTypes(visibleNode, renderers);
  return (
    <>
      {missing.length > 0 && (
        <div role="note" style={{ padding: 8, border: '1px solid #b45309', fontSize: 13 }}>
          Pretext: this theme has no renderer for {missing.join(', ')}. Showing available content
          below.
        </div>
      )}
      <MyST ast={[visibleNode]} />
    </>
  );
});

/** A side note. The theme's aside is built to sit in the page margin (on wide
 * screens it collapses to no height and is moved out of the text), and
 * Pretext's columns have no margin, so the note is drawn in the flow instead:
 * a slim rule on the left, smaller and quieter text. */
export const PretextAside = React.memo(function PretextAside({ node }: { node: any }) {
  const { isDark } = useThemeSwitcher();
  return (
    <div
      className="pretext-aside"
      role="note"
      style={{
        borderLeft: `3px solid ${isDark ? '#57534e' : '#cbd5e1'}`,
        padding: '6px 0 6px 14px',
        fontSize: '0.88em',
        lineHeight: 1.55,
        color: isDark ? DARK.muted : '#475569',
      }}
    >
      <MyST ast={node.children ?? []} />
    </div>
  );
});

const MemoIframe = React.memo(function MemoIframe({
  src,
  iframeHeight,
  captionChildren,
  title,
}: {
  src: string;
  iframeHeight: number;
  captionChildren: any[];
  title: string;
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
        title={title}
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
  textStyle,
  onHeightChange,
}: {
  richBlocks: PlacedRichBlock[];
  textStyle: TextStyle;
  onHeightChange?: (richBlockIndex: number, height: number) => void;
}) {
  return (
    // Keep intrinsic block measurements alive outside the viewport. Otherwise
    // scrolling replaces estimates piecemeal and changes the paper's geometry.
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        fontFamily: textStyle.fontFamily,
        fontSize: textStyle.fontSize,
        lineHeight: `${textStyle.lineHeight}px`,
        fontWeight: textStyle.fontWeight,
      }}
    >
      {/* The flow engine owns block spacing. Native equation margins otherwise
          get counted once by measurement and again as paragraph separation.
          Only Pretext display equations are normalized; article mode, inline
          math, tables and the equation's real scrollbar remain untouched. */}
      <style>{`
        .pretext-rich-block[data-pretext-block-kind="math"] > div {
          margin-block: 0;
        }
        .pretext-rich-block ol, .pretext-rich-block ul {
          padding-inline-start: 1.5em;
          margin-block: .5em;
          list-style-position: outside;
        }
        .pretext-rich-block ol { list-style-type: decimal; }
        .pretext-rich-block ul { list-style-type: disc; }
        .pretext-rich-block .task-list-item { list-style-type: none; }
        .pretext-rich-block .task-list-item-checkbox {
          position: static;
          margin: 0 .5em 0 0;
        }
        .pretext-rich-block .task-list-item > p { display: inline; }
        .pretext-aside > :first-child { margin-top: 0; }
        .pretext-aside > :last-child { margin-bottom: 0; }
        .pretext-aside p { margin-block: .3em; }
      `}</style>
      {richBlocks.map((block, i) => {
        const iframeNode = simpleIframe(block.node);

        if (iframeNode) {
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
            <MeasuredRichBlock key={i} block={block} onHeightChange={onHeightChange}>
              <MemoIframe
                src={src}
                iframeHeight={ih}
                captionChildren={captionNode?.children ?? []}
                title={iframeNode.title ?? 'Interactive article content'}
              />
            </MeasuredRichBlock>
          );
        }

        if (block.node?.type === 'aside') {
          return (
            <MeasuredRichBlock key={i} block={block} onHeightChange={onHeightChange}>
              <PretextAside node={block.node} />
            </MeasuredRichBlock>
          );
        }

        return (
          <MeasuredRichBlock key={i} block={block} onHeightChange={onHeightChange}>
            <MemoNativeBlock node={block.node} />
          </MeasuredRichBlock>
        );
      })}
    </div>
  );
}
