import {
  getColumnFrames,
  layoutBlocksInColumns,
  type ColumnLayoutOptions,
} from './column-layout.js';
import {
  FIGURE_BLOCK_WIDTH_RATIO,
  FIGURE_CAPTION_ESTIMATE_H,
  FIGURE_FALLBACK_ASPECT_RATIO,
  FIGURE_INLINE_MAX_W,
  FIGURE_MIN_H,
  FIGURE_MIN_W,
  FIGURE_WIDTH_DEFAULT,
  INTERACTIVE_FIGURE_HEADER_H,
  PRETEXT_TEXT_STYLE,
} from './config.js';
import { getOpeningLayout } from './layout-cache.js';
import type { ContentBlock, LayoutResult, ObstacleRect, TextStyle } from './layout.js';
import type { FigureInfo, FigurePosition } from './model.js';
import { figureParts } from './content-detection.js';

function findFirstImageNode(node: any): any | null {
  if (!node) return null;
  if (node.type === 'image') return node;
  for (const child of node.children ?? []) {
    const found = findFirstImageNode(child);
    if (found) return found;
  }
  return null;
}

function parseDimension(value: unknown, relativeTo: number): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const percent = trimmed.match(/^([0-9.]+)%$/);
  if (percent) return relativeTo * (Number(percent[1]) / 100);
  const pixels = trimmed.match(/^([0-9.]+)px$/);
  if (pixels) return Number(pixels[1]);
  const plain = Number(trimmed);
  return Number.isFinite(plain) ? plain : null;
}

function getFigureNaturalAspectRatio(fig: FigureInfo, loadedRatio?: number): number {
  if (loadedRatio && Number.isFinite(loadedRatio) && loadedRatio > 0) return loadedRatio;
  const imageNode = findFirstImageNode(fig.mdastNode);
  const naturalW = Number(imageNode?.width ?? imageNode?.naturalWidth ?? imageNode?.originalWidth);
  const naturalH = Number(
    imageNode?.height ?? imageNode?.naturalHeight ?? imageNode?.originalHeight,
  );
  if (naturalW > 0 && naturalH > 0) return naturalH / naturalW;
  return FIGURE_FALLBACK_ASPECT_RATIO;
}

/** Interactive cards keep the output's measured aspect ratio, so their height
 * is always derived from their width (also while being resized). */
export function figureHeightForWidth(
  fig: FigureInfo,
  width: number,
  loadedRatio?: number,
  captionHeight?: number,
): number {
  const ratio =
    loadedRatio && Number.isFinite(loadedRatio) && loadedRatio > 0
      ? loadedRatio
      : FIGURE_FALLBACK_ASPECT_RATIO;
  const hasCaption = figureParts(fig.mdastNode).captions.length > 0;
  const chrome =
    (fig.interactive ? INTERACTIVE_FIGURE_HEADER_H : 0) +
    (hasCaption ? (captionHeight ?? FIGURE_CAPTION_ESTIMATE_H) : 18);
  return Math.round(Math.max(FIGURE_MIN_H, Math.round(width * ratio) + chrome));
}

export function getFigureDisplaySize(
  fig: FigureInfo,
  containerWidth: number,
  loadedRatio?: number,
  captionHeight?: number,
): { width: number; height: number } {
  const articleLikeWidth = Math.max(FIGURE_MIN_W, Math.min(containerWidth, FIGURE_INLINE_MAX_W));
  if (fig.interactive) {
    const width = Math.round(Math.min(containerWidth, articleLikeWidth));
    return { width, height: figureHeightForWidth(fig, width, loadedRatio, captionHeight) };
  }
  const imageNode = findFirstImageNode(fig.mdastNode);
  const declaredWidth =
    parseDimension(fig.mdastNode?.width, articleLikeWidth) ??
    parseDimension(fig.mdastNode?.style?.width, articleLikeWidth) ??
    parseDimension(imageNode?.width, articleLikeWidth);
  const width = Math.round(
    Math.max(
      Math.min(FIGURE_MIN_W, containerWidth),
      Math.min(
        containerWidth,
        declaredWidth ?? Math.min(articleLikeWidth, FIGURE_WIDTH_DEFAULT * 2.6),
      ),
    ),
  );
  const declaredHeight =
    parseDimension(fig.mdastNode?.height, width) ??
    parseDimension(fig.mdastNode?.style?.height, width) ??
    parseDimension(imageNode?.height, width);
  const imageHeight =
    declaredHeight != null
      ? declaredHeight * (declaredWidth ? Math.min(1, width / declaredWidth) : 1)
      : Math.round(width * getFigureNaturalAspectRatio(fig, loadedRatio));
  const hasCaption = figureParts(fig.mdastNode).captions.length > 0;
  const height = Math.round(
    Math.max(
      FIGURE_MIN_H,
      imageHeight + (hasCaption ? (captionHeight ?? FIGURE_CAPTION_ESTIMATE_H) : 18),
    ),
  );
  return { width, height };
}

export function toObstacleRects(
  positions: FigurePosition[],
  containerWidth: number,
): ObstacleRect[] {
  return positions.map((position, figureIndex) => {
    const blocksFullLine =
      position.inline || position.width >= containerWidth * FIGURE_BLOCK_WIDTH_RATIO;
    return {
      left: blocksFullLine ? 0 : position.x,
      top: position.y,
      right: blocksFullLine ? containerWidth : position.x + position.width,
      bottom: position.y + position.height,
      figureIndex,
      inline: position.inline,
    };
  });
}

/** Initial (inline) figure positions, and the layout pass they were found with. */
export function buildInitialFigureLayout(
  blocks: ContentBlock[],
  figures: FigureInfo[],
  containerWidth: number,
  imageRatios: Record<number, number>,
  columnOptions: ColumnLayoutOptions,
  textStyle: TextStyle = PRETEXT_TEXT_STYLE,
  captionHeights: Record<number, number> = {},
): { positions: FigurePosition[]; layout: LayoutResult } {
  const frames = getColumnFrames(containerWidth, columnOptions);
  const figureContainerWidth = frames[0]?.width ?? containerWidth;
  const sizes = figures.map((fig, index) =>
    getFigureDisplaySize(fig, figureContainerWidth, imageRatios[index], captionHeights[index]),
  );
  const sizingObstacles: ObstacleRect[] = sizes.map((size, figureIndex) => ({
    left: 0,
    top: 0,
    right: containerWidth,
    bottom: size.height,
    figureIndex,
    inline: true,
  }));
  const dimensionKey = sizes.map((size) => `${size.width}x${size.height}`).join(';');
  const textStyleKey = JSON.stringify(textStyle);
  const opening = getOpeningLayout(
    blocks,
    `native-flow:${containerWidth}:${columnOptions.count}:${columnOptions.gap}:${columnOptions.columnHeight}:${columnOptions.bandGap}:${textStyleKey}:${dimensionKey}`,
    () =>
      layoutBlocksInColumns(blocks, sizingObstacles, containerWidth, 0, textStyle, columnOptions),
  );
  const anchors = opening.figureAnchors;
  const anchorsByFigure = new Map(anchors.map((anchor) => [anchor.figureIndex, anchor]));
  const positions = figures.map((_, i) => {
    const anchor = anchorsByFigure.get(i);
    const anchorLeft = anchor?.x ?? 0;
    const anchorWidth = anchor?.width ?? containerWidth;
    return {
      x: Math.max(0, Math.round(anchorLeft + (anchorWidth - sizes[i].width) / 2)),
      y: anchor?.y ?? 40 + i * (sizes[i].height + 32),
      width: sizes[i].width,
      height: sizes[i].height,
      inline: true,
    };
  });
  return { positions, layout: opening };
}

export function buildInitialFigurePositions(
  blocks: ContentBlock[],
  figures: FigureInfo[],
  containerWidth: number,
  imageRatios: Record<number, number>,
  columnOptions: ColumnLayoutOptions,
  textStyle: TextStyle = PRETEXT_TEXT_STYLE,
  captionHeights: Record<number, number> = {},
): FigurePosition[] {
  return buildInitialFigureLayout(
    blocks,
    figures,
    containerWidth,
    imageRatios,
    columnOptions,
    textStyle,
    captionHeights,
  ).positions;
}

/** Commit prose and anchored cards from the same layout pass. Inline card
 * positions are outputs, while manually moved cards remain fixed obstacles. */
export function layoutWithFigures(
  blocks: ContentBlock[],
  positions: FigurePosition[],
  containerWidth: number,
  textStyle: TextStyle,
  options: ColumnLayoutOptions,
  /** The opening pass from buildInitialFigureLayout. While no figure has been
   * moved, it is identical to laying out again, so it is reused (half the work
   * per settings change). */
  opening?: LayoutResult,
) {
  const layout =
    opening && positions.every((position) => position.inline)
      ? opening
      : layoutBlocksInColumns(
          blocks,
          toObstacleRects(positions, containerWidth),
          containerWidth,
          0,
          textStyle,
          options,
        );
  const anchors = new Map(layout.figureAnchors.map((anchor) => [anchor.figureIndex, anchor]));
  return {
    layout,
    positions: positions.map((position, index) => {
      const anchor = anchors.get(index);
      if (!position.inline || !anchor) return position;
      return {
        ...position,
        x: anchor.x + Math.max(0, (anchor.width - position.width) / 2),
        y: anchor.y,
      };
    }),
  };
}
