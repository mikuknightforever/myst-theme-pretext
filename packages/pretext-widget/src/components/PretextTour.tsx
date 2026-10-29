import * as React from 'react';
import { GLASS_FONT, glassTheme } from './glass.js';

/** A control the tour points at carries data-pretext-tour="<target>". */
export const TOUR_ATTRIBUTE = 'data-pretext-tour';

export interface TourStep {
  /** The control to light up; empty for a step that only shows its card. */
  target: string;
  title: string;
  body: string;
  /** When none of its targets is on screen, scroll the nearest one into view
   * (the tour returns the reader to where it was when it ends). */
  scrollTo?: boolean;
  /** A line under the text, such as "Powered by Pretext", with a link. */
  credit?: { before: string; label: string; href: string };
}

/** The reader's controls, in the order they sit in the toolbar. Steps whose
 * control is not on screen (the outline toggle on a narrow window) are left out,
 * except the figure step, which scrolls to a figure when the article has one. */
export const TOUR_STEPS: TourStep[] = [
  {
    target: 'columns',
    title: 'Columns',
    body: 'Read in one to four columns. The text moves into its new places at once, and figures go with it.',
  },
  {
    target: 'justify',
    title: 'Justified text',
    body: 'Switch between justified and left-aligned text. The reader spaces each line itself, so justified lines stay even.',
  },
  {
    target: 'settings',
    title: 'Text size and spacing',
    body: 'Change the text size, the line spacing and the space between paragraphs. Reset brings back the defaults.',
  },
  {
    target: 'effects',
    title: 'Text effects',
    body: 'Effects that play with the words: none, scatter away from the cursor, magnify under it, explode on a click, or leaves fired by the floating logo.',
  },
  {
    target: 'figure',
    title: 'Drop it anywhere',
    body: 'Drag a figure into the text, and the words flow around it like water around a stone. Drag its bottom-right corner to resize it.',
    scrollTo: true,
  },
  {
    target: 'outline',
    title: 'On this page',
    body: 'Show or hide the list of sections. Click a section to go to it.',
  },
  {
    target: 'theme',
    title: 'Light and dark',
    body: 'Switch between the light and the dark page.',
  },
  {
    target: 'exit',
    title: 'Back to the article',
    body: 'Leave the reader and return to the normal page. Esc does the same.',
  },
  {
    target: 'help',
    title: 'This tour',
    body: 'Start this tour again here whenever you like.',
  },
];

/** The first step when the tour starts on its own, the first time the reader
 * opens: what the reader is, before its controls. */
export const TOUR_INTRO: TourStep = {
  target: '',
  title: 'Breaking the mould',
  body: 'On most pages, text is poured into a fixed layout and sets there. Here every word finds its own place, live. Move a figure, change the columns or the text size, and the article flows to fit.',
};

/** True when the page address asks for the tour, as in ?tour or ?tour=1. */
export function tourRequested(search: string): boolean {
  const value = new URLSearchParams(search).get('tour');
  return value != null && value !== '0' && value !== 'false';
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const SPOT_PADDING = 8;
/** Taller than this, a target is a panel (a figure card), not a button or a
 * row of buttons. */
const PANEL_HEIGHT = 80;

/** A circle around a roughly square control, a rounded pill around a wide one
 * (such as the row of effect buttons), so the light never covers neighbours,
 * and a rounded rectangle that hugs a large panel such as a figure. */
export function spotlightShape(target: Rect): Rect & { radius: number } {
  if (target.height > PANEL_HEIGHT) {
    return {
      left: target.left - SPOT_PADDING,
      top: target.top - SPOT_PADDING,
      width: target.width + SPOT_PADDING * 2,
      height: target.height + SPOT_PADDING * 2,
      radius: 20,
    };
  }
  const wide = target.width > target.height * 1.8;
  if (wide) {
    const height = target.height + SPOT_PADDING * 2;
    return {
      left: target.left - SPOT_PADDING,
      top: target.top - SPOT_PADDING,
      width: target.width + SPOT_PADDING * 2,
      height,
      radius: height / 2,
    };
  }
  const size = Math.max(target.width, target.height) + SPOT_PADDING * 2;
  return {
    left: target.left + target.width / 2 - size / 2,
    top: target.top + target.height / 2 - size / 2,
    width: size,
    height: size,
    radius: size / 2,
  };
}

const CARD_GAP = 16;
const EDGE = 12;

/** The card sits above a spotlight in the lower half of the window and below
 * one in the upper half, centred on it and kept inside the window. When there
 * is no room on either side (a large figure), it sits inside the spotlight's
 * top-right corner. */
export function cardPosition(
  spot: Rect,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const clampLeft = (left: number) =>
    Math.min(Math.max(EDGE, left), Math.max(EDGE, viewport.width - card.width - EDGE));
  const clampTop = (top: number) =>
    Math.min(Math.max(EDGE, top), Math.max(EDGE, viewport.height - card.height - EDGE));
  const aboveTop = spot.top - CARD_GAP - card.height;
  const belowTop = spot.top + spot.height + CARD_GAP;
  const fitsAbove = aboveTop >= EDGE;
  const fitsBelow = belowTop + card.height <= viewport.height - EDGE;
  const preferBelow = spot.top + spot.height / 2 < viewport.height / 2;
  const centred = clampLeft(spot.left + spot.width / 2 - card.width / 2);
  if (preferBelow ? fitsBelow : fitsAbove) {
    return { left: centred, top: preferBelow ? belowTop : aboveTop };
  }
  if (preferBelow ? fitsAbove : fitsBelow) {
    return { left: centred, top: preferBelow ? aboveTop : belowTop };
  }
  return {
    left: clampLeft(spot.left + spot.width - card.width - CARD_GAP),
    top: clampTop(Math.max(spot.top, 0) + CARD_GAP),
  };
}

function isOnScreen(element: Element): boolean {
  const r = element.getBoundingClientRect();
  return (
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.right > 0 &&
    r.top < window.innerHeight &&
    r.left < window.innerWidth
  );
}

/** The first element on screen that is marked as this step's control (every
 * figure card is marked, and the tour shows the one in view). With anywhere,
 * the first marked element even when it is scrolled out of view. */
export function findTarget(
  root: ParentNode,
  target: string,
  { anywhere = false }: { anywhere?: boolean } = {},
): Element | undefined {
  const marked = Array.from(root.querySelectorAll(`[${TOUR_ATTRIBUTE}="${target}"]`));
  return marked.find(isOnScreen) ?? (anywhere ? marked[0] : undefined);
}

/** The steps whose control can be shown: on screen, or reachable by scrolling. */
export function availableSteps(root: ParentNode, steps: TourStep[] = TOUR_STEPS): TourStep[] {
  return steps.filter(
    (step) => !step.target || findTarget(root, step.target, { anywhere: step.scrollTo }) != null,
  );
}

function scrollParent(element: Element): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/**
 * A short guided tour of the reader. The window is dimmed except for a
 * spotlight on one control at a time, with a card that says what it does.
 */
export function PretextTour({
  root,
  isDark,
  steps: requestedSteps = TOUR_STEPS,
  doneLabel = 'Done',
  skipLabel = 'Skip tour',
  onDone,
  onClose,
  zIndex = 200,
}: {
  /** Where the controls are; the tour looks for them inside it. */
  root: HTMLElement | null;
  isDark: boolean;
  steps?: TourStep[];
  /** The last step's main button. */
  doneLabel?: string;
  skipLabel?: string;
  /** Called by the last step's main button (otherwise it closes the tour). */
  onDone?: () => void;
  /** Called when the tour ends any other way: skip, Esc, or Done without onDone. */
  onClose: () => void;
  zIndex?: number;
}) {
  const theme = glassTheme(isDark);
  const [steps, setSteps] = React.useState<TourStep[]>([]);
  const [index, setIndex] = React.useState(0);
  const [spot, setSpot] = React.useState<(Rect & { radius: number }) | null>(null);
  const [cardAt, setCardAt] = React.useState<{ left: number; top: number } | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const nextRef = React.useRef<HTMLButtonElement>(null);
  // Where the reader was before the tour scrolled to a figure, to go back there.
  const savedScroll = React.useRef<{ element: HTMLElement; top: number } | null>(null);
  React.useEffect(
    () => () => {
      const saved = savedScroll.current;
      if (saved) saved.element.scrollTo({ top: saved.top, behavior: 'smooth' });
    },
    [],
  );

  React.useEffect(() => {
    if (root) setSteps(availableSteps(root, requestedSteps));
  }, [root, requestedSteps]);

  const step = steps[index];
  const last = index === steps.length - 1;

  // Place the spotlight and the card, and keep them in place on resize and scroll.
  React.useLayoutEffect(() => {
    if (!root || !step) return;
    const placeCard = (shape: Rect | null) => {
      const card = cardRef.current;
      if (!card) return;
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      if (!shape) {
        // A step without a control: the card in the middle of the window.
        setCardAt({
          left: (window.innerWidth - size.width) / 2,
          top: Math.max(EDGE, (window.innerHeight - size.height) / 2 - 40),
        });
        return;
      }
      setCardAt(cardPosition(shape, size, { width: window.innerWidth, height: window.innerHeight }));
    };
    const place = () => {
      if (!step.target) {
        setSpot(null);
        placeCard(null);
        return;
      }
      const onScreen = findTarget(root, step.target);
      const element = onScreen ?? findTarget(root, step.target, { anywhere: step.scrollTo });
      if (!element) return;
      if (!onScreen) {
        const scroller = scrollParent(element);
        if (scroller && !savedScroll.current) {
          savedScroll.current = { element: scroller, top: scroller.scrollTop };
        }
        // The spotlight follows on each scroll event until the figure arrives.
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      const r = element.getBoundingClientRect();
      const shape = spotlightShape({ left: r.left, top: r.top, width: r.width, height: r.height });
      setSpot(shape);
      placeCard(shape);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [root, step]);

  React.useEffect(() => nextRef.current?.focus({ preventScroll: true }), [index, steps.length]);

  const next = React.useCallback(() => {
    if (!last) setIndex((i) => i + 1);
    else (onDone ?? onClose)();
  }, [last, onClose, onDone]);
  const back = React.useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // The tour owns the keyboard while it is open; Esc ends the tour, not the reader.
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === 'ArrowLeft') back();
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [back, next, onClose]);

  if (steps.length === 0 || !step) return null;

  const button: React.CSSProperties = {
    height: 34,
    padding: '0 14px',
    border: 0,
    borderRadius: 12,
    fontFamily: GLASS_FONT,
    fontSize: 13,
    fontWeight: 650,
    cursor: 'pointer',
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pretext-tour-title"
      aria-describedby="pretext-tour-body"
      style={{ position: 'fixed', inset: 0, zIndex, fontFamily: GLASS_FONT }}
    >
      {/* A step without a control dims the whole window. */}
      {!step.target && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.6)',
          }}
        />
      )}
      {/* The spotlight: a clear shape whose shadow darkens the rest of the window. */}
      {spot && step.target && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: spot.left,
            top: spot.top,
            width: spot.width,
            height: spot.height,
            borderRadius: spot.radius,
            boxShadow: `0 0 0 2px rgba(255,255,255,0.85), 0 0 0 200vmax ${
              isDark ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.6)'
            }`,
            transition: 'left 320ms ease, top 320ms ease, width 320ms ease, height 320ms ease, border-radius 320ms ease',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        ref={cardRef}
        style={{
          ...theme.surface,
          background: isDark ? 'rgba(28,25,23,0.94)' : 'rgba(255,255,255,0.96)',
          position: 'fixed',
          left: cardAt?.left ?? -9999,
          top: cardAt?.top ?? -9999,
          width: 'min(320px, calc(100vw - 24px))',
          boxSizing: 'border-box',
          padding: '16px 18px 14px',
          borderRadius: 18,
          color: theme.text,
          transition: 'left 320ms ease, top 320ms ease',
        }}
      >
        {steps.length > 1 && (
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.muted, marginBottom: 4 }}>
            {index + 1} of {steps.length}
          </div>
        )}
        <h2 id="pretext-tour-title" style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>
          {step.title}
        </h2>
        <p id="pretext-tour-body" style={{ margin: '0 0 14px', fontSize: 13.5, lineHeight: 1.5 }}>
          {step.body}
        </p>
        {step.credit && (
          <p style={{ margin: '-6px 0 14px', fontSize: 12, color: theme.muted }}>
            {step.credit.before}{' '}
            <a
              href={step.credit.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.accent, fontWeight: 600, textDecoration: 'underline' }}
            >
              {step.credit.label}
            </a>
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ ...button, padding: '0 4px', background: 'transparent', color: theme.muted }}
          >
            {skipLabel}
          </button>
          <span style={{ flex: 1 }} />
          {index > 0 && (
            <button
              type="button"
              onClick={back}
              style={{ ...button, background: 'transparent', color: theme.text }}
            >
              Back
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            style={{ ...button, background: theme.accentBg, color: theme.accent }}
          >
            {last ? doneLabel : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
