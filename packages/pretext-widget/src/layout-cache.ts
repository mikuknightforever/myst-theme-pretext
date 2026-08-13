import type { ContentBlock, LayoutResult } from './layout.js';

const openingLayoutCache = new WeakMap<ContentBlock[], Map<string, LayoutResult>>();

/** Cache only the small set of opening layouts needed by one article. */
export function getOpeningLayout(
  blocks: ContentBlock[],
  key: string,
  calculate: () => LayoutResult,
): LayoutResult {
  let entries = openingLayoutCache.get(blocks);
  if (!entries) {
    entries = new Map();
    openingLayoutCache.set(blocks, entries);
  }
  const cached = entries.get(key);
  if (cached) return cached;
  const result = calculate();
  if (entries.size >= 4) {
    const oldest = entries.keys().next().value;
    if (oldest) entries.delete(oldest);
  }
  entries.set(key, result);
  return result;
}
