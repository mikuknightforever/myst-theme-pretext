import { load } from 'js-yaml';
import type { HeadingAnchor } from './layout/types.js';

/** Class (or code language) that marks a figure-region annotation block. */
export const REGION_ANNOTATION_CLASS = 'pretext-regions';

/** A part of a figure that the text discusses in one or more sections. */
export interface FigureRegion {
  id: string;
  label: string;
  /** x0, y0, x1, y1 as fractions of the image's width and height. */
  box: [number, number, number, number];
  /** Section references as the author wrote them (heading labels or titles). */
  sections: string[];
  /** Heading ids in Pretext's outline that the references resolved to. */
  sectionIds: string[];
  description?: string;
}

export interface RegionAnnotation {
  /** Label of the figure the regions belong to; omitted means the nearest
   * preceding figure. */
  figure?: string;
  regions: FigureRegion[];
}

/** An annotation is an ordinary code block, so stock MyST parses it without a
 * plugin: either ```` ```pretext-regions ```` or a `{code}` block with
 * `:class: pretext-regions`. */
export function isRegionAnnotation(node: any): boolean {
  if (node?.type !== 'code') return false;
  if (String(node.lang ?? '').trim() === REGION_ANNOTATION_CLASS) return true;
  return String(node.class ?? node.className ?? '')
    .split(/\s+/)
    .includes(REGION_ANNOTATION_CLASS);
}

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : undefined;

function parseBox(value: unknown): FigureRegion['box'] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const numbers = value.map((item) => (typeof item === 'number' ? item : Number(item)));
  if (numbers.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) return null;
  const [x0, y0, x1, y1] = numbers;
  if (x1 <= x0 || y1 <= y0) return null;
  return [x0, y0, x1, y1];
}

/** Parse one annotation block. Anything unusable yields null or drops the
 * offending region, so a broken annotation only switches the feature off. */
export function parseRegionAnnotation(source: string): RegionAnnotation | null {
  let data: any;
  try {
    data = load(source);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.regions)) return null;
  const seen = new Set<string>();
  const regions: FigureRegion[] = [];
  data.regions.forEach((raw: any, index: number) => {
    if (!raw || typeof raw !== 'object') return;
    const box = parseBox(raw.box);
    if (!box) return;
    let id = asText(raw.id) || `region-${index + 1}`;
    if (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    const sectionList = Array.isArray(raw.sections)
      ? raw.sections
      : raw.sections != null
        ? [raw.sections]
        : raw.section != null
          ? [raw.section]
          : [];
    regions.push({
      id,
      label: asText(raw.label) || id,
      box,
      sections: sectionList
        .map(asText)
        .filter((name: string | undefined): name is string => !!name),
      sectionIds: [],
      ...(asText(raw.description) && { description: asText(raw.description) }),
    });
  });
  if (regions.length === 0) return null;
  const figure = asText(data.figure);
  return figure ? { figure, regions } : { regions };
}

/** Labels are compared the way readers write them: case-insensitive, with or
 * without a leading `#`, and with MyST's `:`/`-` html_id spelling. */
export function normalizeReference(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
}

function referenceVariants(value: unknown): string[] {
  const normalized = normalizeReference(value);
  if (!normalized) return [];
  const htmlLike = normalized.replace(/[^\p{L}\p{N}_-]+/gu, '-');
  return htmlLike === normalized ? [normalized] : [normalized, htmlLike];
}

/** Every name an author may use for a figure or heading node. */
export function nodeReferenceNames(node: any, extra: unknown[] = []): string[] {
  const names = new Set<string>();
  for (const value of [node?.label, node?.identifier, node?.html_id, ...extra]) {
    for (const name of referenceVariants(value)) names.add(name);
  }
  return [...names];
}

export function referenceMatches(reference: string, names: string[]): boolean {
  return referenceVariants(reference).some((variant) => names.includes(variant));
}

/** The heading being read, followed by the headings that contain it. */
export function sectionChain(headings: HeadingAnchor[], activeId: string | null): HeadingAnchor[] {
  const index = headings.findIndex((heading) => heading.id === activeId);
  if (index < 0) return [];
  const chain = [headings[index]];
  let depth = headings[index].depth;
  for (let i = index - 1; i >= 0 && depth > 1; i -= 1) {
    if (headings[i].depth < depth) {
      chain.push(headings[i]);
      depth = headings[i].depth;
    }
  }
  return chain;
}

/** The most specific section in the chain that the figure describes, and the
 * regions linked to it. Null when no section being read is linked. */
export function focusedRegions(
  regions: FigureRegion[] | undefined,
  chain: HeadingAnchor[],
): { heading: HeadingAnchor; regionIds: Set<string> } | null {
  if (!regions?.length) return null;
  for (const heading of chain) {
    const linked = regions.filter((region) => region.sectionIds.includes(heading.id));
    if (linked.length) return { heading, regionIds: new Set(linked.map((region) => region.id)) };
  }
  return null;
}

/** The region under a point given in image fractions; the smallest one wins,
 * so a detail inside a larger region stays reachable. */
export function regionAt(
  regions: FigureRegion[] | undefined,
  fx: number,
  fy: number,
): FigureRegion | null {
  let best: FigureRegion | null = null;
  let bestArea = Infinity;
  for (const region of regions ?? []) {
    const [x0, y0, x1, y1] = region.box;
    if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
    const area = (x1 - x0) * (y1 - y0);
    if (area < bestArea) {
      best = region;
      bestArea = area;
    }
  }
  return best;
}
