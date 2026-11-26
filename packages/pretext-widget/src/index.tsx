import type { NodeRenderers } from '@myst-theme/providers';
import { PretextWidgetRenderer } from './renderers.js';
import { REGION_ANNOTATION_CLASS } from './figure-regions.js';

export { PretextArticle } from './renderers.js';

/** Figure-region annotations are author metadata for Pretext. They are code
 * blocks so stock MyST parses them; the article view must not show them. */
const HiddenRegionAnnotation = () => null;

export const PRETEXT_RENDERERS: NodeRenderers = {
  'pretext-widget': PretextWidgetRenderer,
  // Selectors only: the theme's own `code` renderer stays the base renderer.
  code: {
    [`code[lang=${REGION_ANNOTATION_CLASS}]`]: HiddenRegionAnnotation,
    [`code[class~=${REGION_ANNOTATION_CLASS}]`]: HiddenRegionAnnotation,
  } as NodeRenderers[string],
};
