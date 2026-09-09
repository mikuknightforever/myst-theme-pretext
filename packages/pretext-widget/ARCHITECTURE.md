# Pretext module boundaries

Pretext is currently an integrated MyST article-theme feature, not an independent
installer. Keep its source Markdown and resolved AST unchanged.

## Data flow

1. `activation.ts` resolves site/page policy; `renderers.tsx` owns the article
   session and launcher, inside MyST's providers.
2. `content-detection.ts` classifies nodes; `content/inline.ts` extracts styled
   tokens; `content/article.ts` collects blocks, figure anchors and legacy helpers.
3. `layout/types.ts` defines the shared layout contract. `layout/measurements.ts`
   measures tokens through a bounded LRU; `layout/flow.ts` places one text flow.
4. `columns/shared.ts` holds frame/obstacle and paragraph-splitting primitives.
   `obstacle-flow.ts` handles manually placed figures; `band-flow.ts` lays out one
   bounded group of columns; `pagination.ts` chooses successive group heights.
   No rule may depend on one paper's wording or figure identifiers.
5. `figure-layout.ts` sizes cards and commits figure positions with prose from
   the same layout result. `layout-cache.ts` caches a bounded set of opening layouts.
6. `hooks/usePretextLayout.ts` owns measured sizes and derived layout state.
   `useFigureInteractions.ts` owns pointer gestures; `useReadingNavigation.ts`
   owns reading-position restoration and local reference navigation.
7. `components/PretextOverlay.tsx` composes the UI. `layers/` and `figures/` render
   and report measurements; they do not choose where columns break.

`layout.ts` and `column-layout.ts` remain compatibility facades. Existing imports
continue to work; new engine internals should use the focused modules directly.
The React package's public entry remains `index.tsx`.

## Tests and invariants

- Existing geometry/content/entry tests cover source order, conservation of
  content, figure boundaries, column continuity and opt-in/opt-out policy.
- `layout-characterization.spec.ts` stores SHA-256 snapshots of complete layout
  results for 1/2/3 columns and two font sizes, captured before splitting modules.
  Do not update these snapshots simply to make a refactor pass. Explain and
  separately review any intended change in geometry.
- `lru-cache.spec.ts` verifies eviction, recency, updates, invalid capacities and
  bounded size after 50,000 insertions. This is not a browser memory benchmark.
- Theme startup tests live in `themes/article/tests` and are included in the
  unified quality command, not only a manually invoked test runner.
- Browser acceptance remains necessary: canvas mocks cannot validate actual
  font metrics, DOM equations, scrollbars, dragging or accessibility.

## Remaining boundaries

Dynamic MyST/extension AST fields still use permissive types at several adapter
boundaries. This refactor extracts responsibilities without pretending those
fields are fully schema-validated. A later change should introduce narrowed node
types and tests for third-party extensions, independently of geometry changes.
Coverage thresholds, automated browser visual regression, accessibility and
large-article performance budgets are not established by these unit checks.
