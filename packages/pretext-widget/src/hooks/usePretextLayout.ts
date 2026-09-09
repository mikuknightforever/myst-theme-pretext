import * as React from 'react';
import type { ColumnCount, ColumnLayoutOptions } from '../column-layout.js';
import { COLUMN_GAP, COLUMN_PAGE_GAP, COLUMN_PAGE_HEIGHT } from '../config.js';
import { buildInitialFigurePositions, layoutWithFigures } from '../figure-layout.js';
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
  const imageRatios = useImageRatios(figures);
  const manualPositions =
    figureLayout?.width === containerWidth &&
    figureLayout?.columns === columnCount &&
    figureLayout?.readingKey === readingKey
      ? figureLayout.positions
      : null;
  const { layout, positions: figPositions } = React.useMemo(() => {
    if (typeof document === 'undefined' || containerWidth <= 0) {
      return { layout: EMPTY_LAYOUT, positions: null };
    }
    const initial = buildInitialFigurePositions(
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
    return layoutWithFigures(measuredBlocks, candidates, containerWidth, textStyle, columnOptions);
  }, [
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
    contentHeight,
    readingKey,
    textStyle,
    setFigureLayout,
    updateCaptionHeight,
    updateRichBlockHeight,
    updateInlineMetrics,
  };
}
