import * as React from 'react';
import { createPortal } from 'react-dom';
import { useReferences, useThemeSwitcher } from '@myst-theme/providers';
import { PretextLauncher } from './components/PretextLauncher.js';
import { PretextOverlay } from './components/PretextOverlay.js';
import { collectArticle } from './layout.js';
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

    return collectArticle(mdast, { draggableSelector });
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
