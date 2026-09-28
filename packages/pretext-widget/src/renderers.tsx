import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  useReferences,
  useThemeSwitcher,
  useSiteManifest,
  useFrontmatter,
} from '@myst-theme/providers';
import { PretextLauncher } from './components/PretextLauncher.js';
import { PretextOverlay } from './components/PretextOverlay.js';
import { collectArticle } from './layout.js';
import { withFrontmatterAbstract } from './content/article.js';
import type { PretextWidget } from './types.js';
import { findNode } from './content-detection.js';
import { resolvePretextMode, type PretextMode } from './activation.js';

const PretextModeContext = React.createContext<PretextMode>('manual');
const PretextHeaderContext = React.createContext<React.ReactNode>(null);

/** Content the theme shows above the article (e.g. its title card), for the overlay. */
export function usePretextHeader(): React.ReactNode {
  return React.useContext(PretextHeaderContext);
}

/** Mount inside the article's providers, once per page, without editing its source AST. */
export function PretextArticle({
  articleId,
  header,
  children,
}: {
  articleId: string;
  /** Shown above the columns in Pretext mode, such as the theme's article header. */
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const site = useSiteManifest();
  const frontmatter = useFrontmatter();
  const references = useReferences();
  const mode = resolvePretextMode(site?.options?.pretext, (frontmatter as any)?.site?.pretext);
  const mdast = (references as any)?.article;
  const legacyNode = React.useMemo(() => findNode(mdast, 'pretext-widget'), [mdast]);

  return (
    <PretextModeContext.Provider key={articleId} value={mode}>
      <PretextHeaderContext.Provider value={header ?? null}>
        {/* The automatic entry is an icon button beside the theme switcher, so it
            takes no space in the article layout. */}
        {mode === 'automatic' && <PretextSession node={legacyNode} variant="icon" />}
        {children}
      </PretextHeaderContext.Provider>
    </PretextModeContext.Provider>
  );
}

export function PretextWidgetRenderer({ node }: { node: PretextWidget }) {
  const mode = React.useContext(PretextModeContext);
  // The automatic entry owns the launcher; a page/site opt-out also hides old directives.
  if (mode !== 'manual') return null;
  return <PretextSession node={node} />;
}

function PretextSession({
  node,
  variant = 'card',
}: {
  node?: PretextWidget;
  variant?: 'icon' | 'card';
}) {
  const references = useReferences();
  const frontmatter = useFrontmatter();
  const header = usePretextHeader();
  const { isDark } = useThemeSwitcher();
  const mdast = (references as any)?.article;
  const [openedArticle, setOpenedArticle] = React.useState<unknown>(null);
  const onClose = React.useCallback(() => setOpenedArticle(null), []);
  // A new page or rebuilt article cannot reuse the previous overlay's measured layout.
  const open = !!mdast && openedArticle === mdast;

  const draggableSelector =
    typeof node?.draggableSelector === 'string' ? node.draggableSelector : 'pretext-draggable';

  const { blocks, figures } = React.useMemo(() => {
    if (!mdast) return { blocks: [], figures: [] };

    return collectArticle(withFrontmatterAbstract(mdast, frontmatter), { draggableSelector });
  }, [mdast, frontmatter, draggableSelector]);

  if (blocks.length === 0) return null;

  return (
    <>
      <PretextLauncher
        blockCount={blocks.length}
        figureCount={figures.length}
        isDark={isDark}
        variant={variant}
        onOpen={() => setOpenedArticle(mdast)}
      />
      {open && typeof document !== 'undefined'
        ? createPortal(
            <PretextOverlay blocks={blocks} figures={figures} header={header} onClose={onClose} />,
            document.body,
          )
        : null}
    </>
  );
}
