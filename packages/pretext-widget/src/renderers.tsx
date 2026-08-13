import * as React from 'react';
import { createPortal } from 'react-dom';
import { useReferences, useThemeSwitcher } from '@myst-theme/providers';
import { PretextLauncher } from './components/PretextLauncher.js';
import { PretextOverlay } from './components/PretextOverlay.js';
import { collectBlocks, findAllDraggableNodes, findImageUrl } from './layout.js';
import type { FigureInfo } from './model.js';
import type { PretextWidget } from './types.js';

export function PretextWidgetRenderer({ node }: { node: PretextWidget }) {
  const references = useReferences();
  const { isDark } = useThemeSwitcher();
  const [open, setOpen] = React.useState(false);
  const onClose = React.useCallback(() => setOpen(false), []);

  const draggableSelector = node.draggableSelector ?? 'pretext-draggable';

  const { blocks, figures } = React.useMemo(() => {
    const mdast = (references as any)?.article;
    if (!mdast) return { blocks: [], figures: [] };

    const blks = collectBlocks(mdast);
    const figNodes = findAllDraggableNodes(mdast, draggableSelector);
    const figs: FigureInfo[] = figNodes.map((figNode, i) => ({
      mdastNode: figNode,
      label: `Figure ${i + 1}`,
      imageUrl: findImageUrl(figNode),
    }));
    return { blocks: blks, figures: figs };
  }, [references, draggableSelector]);

  return (
    <>
      <PretextLauncher
        blockCount={blocks.length}
        figureCount={figures.length}
        isDark={isDark}
        onOpen={() => setOpen(true)}
      />
      {open && typeof document !== 'undefined'
        ? createPortal(
            <PretextOverlay blocks={blocks} figures={figures} onClose={onClose} />,
            document.body,
          )
        : null}
    </>
  );
}
