import * as React from 'react';
import type { ColumnCount, ColumnLayoutOptions } from '../column-layout.js';
import { COLUMN_GAP, COLUMN_PAGE_GAP, COLUMN_PAGE_HEIGHT, FIGURE_INLINE_MAX_W } from '../config.js';
import {
  buildInitialFigureLayout,
  getFigureNaturalAspectRatio,
  resizedCardLayout,
  layoutWithFigures,
} from '../figure-layout.js';
import { useImageRatios } from '../hooks.js';
import { inlineMeasurementKey, styleForBlock } from '../layout/measurements.js';
import type { ContentBlock, InlineMetrics, LayoutResult } from '../layout/types.js';
import type { FigureInfo, FigureLayoutState } from '../model.js';
import { readingSettingsKey, readingTextStyle, type ReadingSettings } from '../reading-settings.js';

const EMPTY_LAYOUT: LayoutResult = {
  spans: [],
  richBlocks: [],
  figureAnchors: [],
  headingAnchors: [],
  contentBottom: 0,
};
const EMPTY_HEIGHTS: Record<number, number> = {};

/** Aspect ratios for notebook-output cards before their output mounts, taken
 * from the same figures already rendered in the article behind the overlay, so
 * cards are the right size while their (slow) charts wait to render. Outputs
 * render at FIGURE_INLINE_MAX_W in cards; fixed-size charts keep their height. */
function seedOutputRatios(figures: FigureInfo[]): Record<number, number> {
  const ratios: Record<number, number> = {};
  if (typeof document === 'undefined') return ratios;
  figures.forEach((fig, index) => {
    const id = fig.interactive ? (fig.mdastNode?.html_id ?? fig.mdastNode?.identifier) : null;
    if (!id) return;
    const onPage = Array.from(document.querySelectorAll(`[id="${CSS.escape(String(id))}"]`)).find(
      (element) => !element.closest('[aria-modal="true"]'),
    );
    if (!onPage) return;
    const caption = onPage.querySelector('figcaption');
    const height =
      onPage.getBoundingClientRect().height - (caption?.getBoundingClientRect().height ?? 0);
    if (height > 0) ratios[index] = height / FIGURE_INLINE_MAX_W;
  });
  return ratios;
}

/** Own measurement feedback and layout state independently from overlay markup. */
export function usePretextLayout({
  blocks,
  figures,
  containerWidth,
  columnCount,
  readingSettings,
}: {
  blocks: ContentBlock[];
  figures: FigureInfo[];
  containerWidth: number;
  columnCount: ColumnCount;
  readingSettings: ReadingSettings;
}) {
  const readingKey = readingSettingsKey(readingSettings);
  const textStyle = React.useMemo(() => readingTextStyle(readingSettings), [readingKey]);
  const columnOptions: ColumnLayoutOptions = {
    count: columnCount,
    gap: COLUMN_GAP,
    columnHeight: COLUMN_PAGE_HEIGHT,
    bandGap: COLUMN_PAGE_GAP,
  };

  const [figureLayout, setFigureLayout] = React.useState<FigureLayoutState | null>(null);
  const richMeasurementScope = `${Math.round(containerWidth)}:${columnCount}:${readingKey}`;
  const [richMeasurements, setRichMeasurements] = React.useState<{
    scope: string;
    heights: Record<number, number>;
  }>({ scope: '', heights: {} });
  const richBlockHeights =
    richMeasurements.scope === richMeasurementScope ? richMeasurements.heights : EMPTY_HEIGHTS;
  const [inlineMetrics, setInlineMetrics] = React.useState<Record<string, InlineMetrics>>({});
  const [captionMeasurements, setCaptionMeasurements] = React.useState<{
    scope: string;
    heights: Record<number, number>;
  }>({ scope: '', heights: {} });
  const captionHeights =
    captionMeasurements.scope === richMeasurementScope
      ? captionMeasurements.heights
      : EMPTY_HEIGHTS;
  const updateCaptionHeight = React.useCallback(
    (index: number, height: number) => {
      setCaptionMeasurements((current) => {
        const heights = current.scope === richMeasurementScope ? current.heights : {};
        if (heights[index] === height) return current;
        return { scope: richMeasurementScope, heights: { ...heights, [index]: height } };
      });
    },
    [richMeasurementScope],
  );
  const measuredBlocks = React.useMemo(() => {
    let fallbackIndex = 0;
    return blocks.map((block) => {
      if (block.type === 'richBlock') {
        const index = block.richBlockIndex ?? fallbackIndex;
        fallbackIndex += 1;
        const measuredHeight = richBlockHeights[index];
        return measuredHeight == null ? block : { ...block, estimatedHeight: measuredHeight };
      }
      if (block.type === 'figureAnchor') return block;
      const blockStyle = styleForBlock(block, textStyle);
      let changed = false;
      const words = block.words.map((word) => {
        if (!word.math && !word.code && !word.semanticNode) return word;
        const metrics = inlineMetrics[inlineMeasurementKey(word, blockStyle)];
        if (!metrics) {
          return word;
        }
        changed = true;
        return { ...word, measuredWidth: metrics.width, measuredHeight: metrics.height };
      });
      return changed ? { ...block, words } : block;
    });
  }, [blocks, inlineMetrics, richBlockHeights, textStyle]);
  const loadedImageRatios = useImageRatios(figures);
  // Interactive outputs report their rendered aspect ratio instead of an image load.
  const [outputRatios, setOutputRatios] = React.useState<Record<number, number>>(() =>
    seedOutputRatios(figures),
  );
  // A chart's container reports a small size while the chart is still loading;
  // keep the size taken from the article until a realistic measurement arrives.
  const seededRatios = React.useRef(outputRatios);
  const confirmedRatios = React.useRef(new Set<number>());
  const updateOutputRatio = React.useCallback((index: number, ratio: number) => {
    const seeded = seededRatios.current[index];
    if (seeded && !confirmedRatios.current.has(index) && ratio < seeded * 0.8) return;
    confirmedRatios.current.add(index);
    setOutputRatios((current) =>
      Math.abs((current[index] ?? 0) - ratio) < 0.005 ? current : { ...current, [index]: ratio },
    );
  }, []);
  const imageRatios = React.useMemo(
    () => ({ ...loadedImageRatios, ...outputRatios }),
    [loadedImageRatios, outputRatios],
  );
  // Captions a reader opened on cards too small to show them inline.
  const [openCaptions, setOpenCaptions] = React.useState<ReadonlySet<number>>(() => new Set());
  const toggleCaption = React.useCallback((index: number) => {
    setOpenCaptions((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);
  const heightForWidth = React.useCallback(
    (index: number, width: number) =>
      figures[index]
        ? resizedCardLayout(
            width,
            getFigureNaturalAspectRatio(figures[index], imageRatios[index]),
            captionHeights[index],
            openCaptions.has(index),
          ).height
        : null,
    [figures, imageRatios, captionHeights, openCaptions],
  );
  const manualPositions =
    figureLayout?.width === containerWidth &&
    figureLayout?.columns === columnCount &&
    figureLayout?.readingKey === readingKey
      ? figureLayout.positions
      : null;
  const {
    layout,
    positions: figPositions,
    basePositions,
    captionModes,
  } = React.useMemo(() => {
    if (typeof document === 'undefined' || containerWidth <= 0) {
      return { layout: EMPTY_LAYOUT, positions: null, basePositions: null, captionModes: [] };
    }
    const { positions: initial, layout: opening } = buildInitialFigureLayout(
      measuredBlocks,
      figures,
      containerWidth,
      imageRatios,
      columnOptions,
      textStyle,
      captionHeights,
    );
    const candidates = initial.map((position, index) =>
      manualPositions?.[index] && !manualPositions[index].inline
        ? manualPositions[index]
        : position,
    );
    // Cards the reader resized: height follows width, so the figure fills the
    // card and its caption (or the caption toggle) sits right under it.
    const modes: Array<'inline' | 'collapsed' | 'expanded'> = [];
    const shown = candidates.map((position, index) => {
      if (position.inline) {
        modes.push('inline');
        return position;
      }
      const card = resizedCardLayout(
        position.width,
        getFigureNaturalAspectRatio(figures[index], imageRatios[index]),
        captionHeights[index],
        openCaptions.has(index),
      );
      modes.push(card.mode);
      return { ...position, height: card.height };
    });
    const result = layoutWithFigures(
      measuredBlocks,
      shown,
      containerWidth,
      textStyle,
      columnOptions,
      opening,
    );
    return { ...result, basePositions: result.positions, captionModes: modes };
  }, [
    openCaptions,
    measuredBlocks,
    figures,
    containerWidth,
    imageRatios,
    columnCount,
    textStyle,
    manualPositions,
    captionHeights,
  ]);
  const { spans, richBlocks, headingAnchors } = layout;

  const updateRichBlockHeight = React.useCallback(
    (index: number, height: number) => {
      setRichMeasurements((current) => {
        const heights = current.scope === richMeasurementScope ? current.heights : {};
        if (Math.abs((heights[index] ?? 0) - height) < 2) {
          return current.scope === richMeasurementScope
            ? current
            : { scope: richMeasurementScope, heights };
        }
        return {
          scope: richMeasurementScope,
          heights: { ...heights, [index]: height },
        };
      });
    },
    [richMeasurementScope],
  );

  const updateInlineMetrics = React.useCallback((metrics: Record<string, InlineMetrics>) => {
    setInlineMetrics((current) => {
      const changed = Object.entries(metrics).some(
        ([key, value]) =>
          current[key]?.width !== value.width || current[key]?.height !== value.height,
      );
      return changed ? { ...current, ...metrics } : current;
    });
  }, []);
  // Avoid Math.max(...largeArray) stack overflow — use a loop instead.
  const contentHeight = React.useMemo(() => {
    let max = 400;
    for (const s of spans) {
      const bottom = s.y + (s.height ?? s.style.lineHeight) + 80;
      if (bottom > max) max = bottom;
    }
    for (const b of richBlocks) {
      const bottom = b.y + b.estimatedHeight + 80;
      if (bottom > max) max = bottom;
    }
    for (const p of figPositions ?? []) {
      const bottom = p.y + p.height + 80;
      if (bottom > max) max = bottom;
    }
    return max;
  }, [spans, richBlocks, figPositions]);

  return {
    layout,
    spans,
    richBlocks,
    headingAnchors,
    figPositions,
    basePositions,
    captionModes,
    toggleCaption,
    contentHeight,
    readingKey,
    textStyle,
    setFigureLayout,
    updateCaptionHeight,
    updateOutputRatio,
    heightForWidth,
    updateRichBlockHeight,
    updateInlineMetrics,
  };
}
