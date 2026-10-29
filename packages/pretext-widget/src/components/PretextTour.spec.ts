import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  TOUR_INTRO,
  TOUR_STEPS,
  availableSteps,
  cardPosition,
  findTarget,
  spotlightShape,
  tourRequested,
} from './PretextTour.js';

const viewport = { width: 1200, height: 800 };
const card = { width: 320, height: 160 };

describe('spotlightShape', () => {
  it('draws a circle around a square button, centred on it', () => {
    const spot = spotlightShape({ left: 100, top: 700, width: 36, height: 36 });
    expect(spot.width).toBe(spot.height);
    expect(spot.radius).toBe(spot.width / 2);
    expect(spot.left + spot.width / 2).toBe(118);
    expect(spot.top + spot.height / 2).toBe(718);
    expect(spot.width).toBeGreaterThan(36);
  });

  it('draws a pill around a wide row of buttons, so neighbours stay dark', () => {
    const spot = spotlightShape({ left: 400, top: 700, width: 190, height: 36 });
    expect(spot.width).toBeGreaterThan(spot.height);
    expect(spot.height).toBeLessThan(80);
    expect(spot.radius).toBe(spot.height / 2);
  });
});

describe('spotlightShape for a large panel', () => {
  it('hugs a figure card with a rounded rectangle instead of a huge circle', () => {
    const spot = spotlightShape({ left: 200, top: 100, width: 820, height: 535 });
    expect(spot.width).toBeLessThan(860);
    expect(spot.height).toBeLessThan(580);
    expect(spot.radius).toBeLessThan(40);
  });
});

describe('cardPosition', () => {
  it('puts the card above a control near the bottom of the window', () => {
    const spot = spotlightShape({ left: 580, top: 740, width: 36, height: 36 });
    const at = cardPosition(spot, card, viewport);
    expect(at.top + card.height).toBeLessThanOrEqual(spot.top);
  });

  it('puts the card below a control near the top of the window', () => {
    const spot = spotlightShape({ left: 1140, top: 16, width: 40, height: 40 });
    const at = cardPosition(spot, card, viewport);
    expect(at.top).toBeGreaterThanOrEqual(spot.top + spot.height);
  });

  it('keeps the card inside the window next to an edge', () => {
    const spot = spotlightShape({ left: 1150, top: 16, width: 40, height: 40 });
    const at = cardPosition(spot, card, viewport);
    expect(at.left + card.width).toBeLessThanOrEqual(viewport.width);
    expect(at.left).toBeGreaterThanOrEqual(0);
  });
});

describe('cardPosition for a large panel', () => {
  it('puts the card inside the spotlight when there is no room above or below', () => {
    const spot = spotlightShape({ left: 200, top: 60, width: 820, height: 700 });
    const at = cardPosition(spot, card, viewport);
    expect(at.top).toBeGreaterThanOrEqual(spot.top);
    expect(at.top + card.height).toBeLessThanOrEqual(spot.top + spot.height);
    expect(at.left + card.width).toBeLessThanOrEqual(spot.left + spot.width);
  });
});

describe('tourRequested', () => {
  it('reads ?tour from the page address', () => {
    expect(tourRequested('?tour')).toBe(true);
    expect(tourRequested('?tour=1')).toBe(true);
    expect(tourRequested('?a=b&tour=yes')).toBe(true);
    expect(tourRequested('')).toBe(false);
    expect(tourRequested('?tour=0')).toBe(false);
    expect(tourRequested('?tour=false')).toBe(false);
  });
});

// A minimal stand-in for the reader's DOM: elements marked for the tour, each
// with a box, some of them outside the window.
function fakeRoot(boxes: Record<string, Array<{ top: number; height?: number }>>) {
  return {
    querySelectorAll(selector: string) {
      const target = /="([^"]+)"/.exec(selector)?.[1] ?? '';
      return (boxes[target] ?? []).map(({ top, height = 36 }) => ({
        id: `${target}@${top}`,
        getBoundingClientRect: () => ({
          left: 100,
          top,
          width: height === 0 ? 0 : 36,
          height,
          right: 136,
          bottom: top + height,
        }),
      }));
    },
  } as unknown as ParentNode;
}

describe('availableSteps and findTarget', () => {
  const previous = (globalThis as any).window;
  beforeEach(() => {
    (globalThis as any).window = { innerWidth: viewport.width, innerHeight: viewport.height };
  });
  afterAll(() => {
    if (previous === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = previous;
  });

  it('leaves out steps whose control is missing or hidden', () => {
    const root = fakeRoot({
      columns: [{ top: 740 }],
      justify: [{ top: 740 }],
      outline: [{ top: 740, height: 0 }], // not shown on a narrow window
      exit: [{ top: 740 }],
    });
    expect(availableSteps(root).map((step) => step.target)).toEqual(['columns', 'justify', 'exit']);
  });

  it('keeps the figure step when the only figures are scrolled out of view', () => {
    const root = fakeRoot({ columns: [{ top: 740 }], figure: [{ top: 2400 }] });
    expect(availableSteps(root).map((step) => step.target)).toEqual(['columns', 'figure']);
    expect(findTarget(root, 'figure')).toBeUndefined();
    expect((findTarget(root, 'figure', { anywhere: true }) as any).id).toBe('figure@2400');
  });

  it('keeps a step without a control, such as the welcome step', () => {
    const root = fakeRoot({ columns: [{ top: 740 }] });
    expect(availableSteps(root, [TOUR_INTRO, ...TOUR_STEPS]).map((step) => step.target)).toEqual([
      '',
      'columns',
    ]);
  });

  it('points at the figure that is in view, not the first one in the article', () => {
    const root = fakeRoot({ figure: [{ top: -900 }, { top: 300 }, { top: 2400 }] });
    expect((findTarget(root, 'figure') as any).id).toBe('figure@300');
  });

  it('describes every step in a sentence or two', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.split('. ').length).toBeLessThanOrEqual(3);
    }
  });

});
