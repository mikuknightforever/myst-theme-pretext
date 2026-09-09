export interface TextStyle {
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 16,
  lineHeight: 24,
  paragraphGap: 16,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontWeight: '400',
  color: 'CanvasText',
};

export interface ObstacleRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Matching draggable figure, when this obstacle represents a figure card. */
  figureIndex?: number;
  /** True while the figure is still in its original article-flow position. */
  inline?: boolean;
}

/** A single word with its inline formatting flags. */
export interface StyledWord {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  /** Whitespace present immediately before/after this token in the source. */
  spaceBefore?: boolean;
  spaceAfter?: boolean;
  math?: boolean; // inline math
  mathHtml?: string; // pre-rendered KaTeX HTML from MyST build pipeline
  /** Exact DOM width fed back after the inline node has rendered once. */
  measuredWidth?: number;
  measuredHeight?: number;
  /** Preserve interactive inline nodes for MyST's native hover/link renderers. */
  semanticNode?: any;
}

/** A block of content extracted from MDAST. */
export type ContentBlock =
  | {
      type: 'paragraph' | 'listItem';
      bullet?: boolean;
      words: StyledWord[];
      /** A column fragment, not the end of the source paragraph. */
      continues?: boolean;
    }
  | {
      type: 'heading';
      depth: number;
      words: StyledWord[];
      headingId: string;
      headingTitle: string;
    }
  | { type: 'richBlock'; node: any; estimatedHeight: number; richBlockIndex?: number }
  | { type: 'figureAnchor'; figureIndex: number };

/** A rich block placed at an absolute Y position for React rendering. */
export interface PlacedRichBlock {
  node: any;
  /** Stable index in document order, used to feed DOM measurements back into layout. */
  richBlockIndex: number;
  x: number;
  y: number;
  width: number;
  estimatedHeight: number;
}

/** Y position of a figure anchor in the text flow. */
export interface FigureAnchor {
  figureIndex: number;
  x: number;
  y: number;
  width: number;
}

/** A heading position used by Pretext Mode's document outline. */
export interface HeadingAnchor {
  id: string;
  title: string;
  depth: number;
  y: number;
}

/** Return value of layoutBlocks. */
export interface LayoutResult {
  spans: WordSpan[];
  richBlocks: PlacedRichBlock[];
  figureAnchors: FigureAnchor[];
  headingAnchors: HeadingAnchor[];
  /** Actual occupied extents of bounded, left-to-right reading groups. */
  columnBands?: {
    top: number;
    bottom: number;
    columnBottoms: number[];
    breaks: ColumnBreak[];
  }[];
  /** First available vertical position after every block in this layout. */
  contentBottom: number;
}

/** Explain early breaks without depending on article text or figure labels. */
export interface ColumnBreak {
  column: number;
  reason: 'heading' | 'lead-in' | 'block' | 'text' | 'float' | 'section-boundary';
  remaining: number;
  required: number;
}

/** A positioned word span ready for rendering. */
export interface WordSpan {
  text: string;
  x: number;
  y: number;
  style: TextStyle;
  bold: boolean;
  italic: boolean;
  code: boolean;
  math?: boolean;
  mathHtml?: string; // pre-rendered KaTeX HTML — use dangerouslySetInnerHTML
  semanticNode?: any; // rendered through MyST to retain links and hover cards
  /** Clamp an over-wide semantic token to the current column and make it scrollable. */
  maxWidth?: number;
  /** Occupied height, including any horizontal scrollbar. */
  height?: number;
}

export interface InlineMetrics {
  width: number;
  height: number;
}
export const INLINE_SCROLLBAR_HEIGHT = 20;
