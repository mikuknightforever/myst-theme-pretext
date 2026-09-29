/** Leaves effect: the Evidence logo floats around the page and every few
 * seconds fires its leaves outward. The leaves slow down, then flutter down and
 * off the page, and the logo grows new ones for the next volley. Each row the
 * logo or a leaf crosses parts around it (words slide aside to both sides and
 * close back behind). Line breaks never change; this only offsets drawing. */
import { LEAF_SHAPES, LOGO_BOX } from './leaf-shapes.js';

export interface Leaf {
  /** Index into LEAF_SHAPES. */
  shape: number;
  /** Size of the leaf's longer side, px, and the size it grows to in flight. */
  size: number;
  targetSize: number;
  /** Centre, in layout (content) coordinates. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Speed the leaf falls at once the launch has worn off, px per second. */
  fall: number;
  /** Radians, radians per second, and the spin it settles to. */
  rotation: number;
  spin: number;
  restSpin: number;
  /** Side-to-side drift once falling, px per second, and its phase. */
  sway: number;
  swayPhase: number;
}

/** Anything the text parts around: a leaf, or the logo itself. */
export interface Obstacle {
  x: number;
  y: number;
  size: number;
}

/** The floating logo. Its position is relative to the view, so it hovers on
 * screen while the reader scrolls. */
export interface Mothership {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  retargetAt: number;
  leaving: boolean;
  /** When the leaves on the logo start growing back, and when it fires next. */
  regrowAt: number;
  nextBurst: number;
}

export const MAX_LEAVES = 12;
/** On-screen size of the logo's longer side, px. */
export const SHIP_SIZE = 140;
const SHIP_SCALE = SHIP_SIZE / Math.max(LOGO_BOX[2], LOGO_BOX[3]);
const LOGO_CX = LOGO_BOX[0] + LOGO_BOX[2] / 2;
const LOGO_CY = LOGO_BOX[1] + LOGO_BOX[3] / 2;
export const REGROW_MS = 900;
const REGROW_DELAY_MS = 500;
const BURST_EVERY_MS = 3000;
const BURST_JITTER_MS = 1000;
const FIRST_BURST_MS = 2200;
export const PULSE_MS = 300;
/** Leaves per volley: the three on the logo plus smaller copies. */
const EXTRA_LEAVES = 2;
const FLIGHT_SIZES = [58, 48, 36];
const EXTRA_SIZES = [30, 24];
const DRAG = 2.4;
const SHIP_PULL = 0.6;
const SHIP_DAMPING = 1.3;
const SHIP_MAX_SPEED = 120;

/** Horizontal offset for the word centred at (cx, cy): words beside an
 * obstacle are pushed away from it, most strongly next to it, fading along the
 * row and over the rows above and below. Smooth everywhere and gentle enough
 * that words on a row never swap order, so a word slides aside and back. */
export function leafParting(cx: number, cy: number, obstacles: readonly Obstacle[]): number {
  let offset = 0;
  for (const leaf of obstacles) {
    const dx = cx - leaf.x;
    const dy = cy - leaf.y;
    const rows = Math.exp(-((dy / (leaf.size * 0.9)) ** 2));
    if (rows < 0.001) continue;
    const side = dx / Math.sqrt(dx * dx + (leaf.size * 0.25) ** 2);
    const along = Math.exp(
      -((Math.max(0, Math.abs(dx) - leaf.size * 0.4) / (leaf.size * 1.6)) ** 2),
    );
    offset += side * leaf.size * 0.55 * rows * along;
  }
  return Math.abs(offset) < 0.05 ? 0 : offset;
}

/** A space between words can shrink to this fraction of its width, and gives
 * up at most MAX_SLACK px (so the wide gap beside a figure is not used). */
const MIN_GAP_FRACTION = 0.3;
const MAX_SLACK = 10;

/** Part one row of words: take the ideal push for each word (`desired`) and
 * adjust it as little as possible so that words never overlap, no space gets
 * narrower than MIN_GAP_FRACTION of what it was, and the first and last words
 * stay inside the row. The room to open a gap comes from the spaces between
 * the other words on the row. `lefts` are sorted left edges. */
export function partRow(
  lefts: ArrayLike<number>,
  widths: ArrayLike<number>,
  desired: ArrayLike<number>,
): number[] {
  const n = lefts.length;
  const slack: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const gap = lefts[i + 1] - (lefts[i] + widths[i]);
    slack.push(gap > 0 ? Math.min(gap * (1 - MIN_GAP_FRACTION), MAX_SLACK) : 0);
  }
  // How far each word can move before the row runs out of space.
  const lower: number[] = new Array(n);
  const upper: number[] = new Array(n);
  let room = 0;
  for (let i = 0; i < n; i++) {
    lower[i] = -room;
    room += slack[i] ?? 0;
  }
  room = 0;
  for (let i = n - 1; i >= 0; i--) {
    upper[i] = room;
    room += slack[i - 1] ?? 0;
  }
  const clamped = Array.from({ length: n }, (_, i) =>
    Math.max(lower[i], Math.min(upper[i], desired[i])),
  );
  // Each space shrinks by at most its slack: fix from the left and from the
  // right, and take the average of the two (both are valid, so it is too).
  const forward = clamped.slice();
  for (let i = 1; i < n; i++) forward[i] = Math.max(forward[i], forward[i - 1] - slack[i - 1]);
  const backward = clamped.slice();
  for (let i = n - 2; i >= 0; i--) backward[i] = Math.min(backward[i], backward[i + 1] + slack[i]);
  return forward.map((value, i) => (value + backward[i]) / 2);
}

/** Where each logo leaf sits on the logo, relative to its centre, and its size there. */
export const LEAF_SLOTS = LEAF_SHAPES.map(({ box: [bx, by, bw, bh] }) => ({
  dx: (bx + bw / 2 - LOGO_CX) * SHIP_SCALE,
  dy: (by + bh / 2 - LOGO_CY) * SHIP_SCALE,
  size: Math.max(bw, bh) * SHIP_SCALE,
}));

/** The logo and its leaves: moves them each frame and fires the volleys. */
export class LeafField {
  leaves: Leaf[] = [];
  ship: Mothership | null = null;
  /** Number of volleys fired (for tests). */
  volleys = 0;
  private top = 0;
  private height = 800;
  private width = 1000;
  private last: number | null = null;
  private now = 0;

  constructor(private readonly random: () => number = Math.random) {}

  setView(top: number, height: number, width: number) {
    this.top = top;
    this.height = height;
    this.width = width;
  }

  get contentWidth() {
    return this.width;
  }

  /** The logo's centre in layout coordinates, with its gentle bob. */
  shipCentre(now = this.now): { x: number; y: number } | null {
    if (!this.ship) return null;
    return { x: this.ship.x, y: this.top + this.ship.y + 6 * Math.sin(now / 650) };
  }

  /** The logo leans into its motion. */
  shipTilt(): number {
    return this.ship ? Math.max(-0.25, Math.min(0.25, this.ship.vx * 0.002)) : 0;
  }

  /** How far the leaves on the logo have grown back, 0 to 1. */
  shipGrowth(now = this.now): number {
    if (!this.ship) return 0;
    return Math.max(0, Math.min(1, (now - this.ship.regrowAt) / REGROW_MS));
  }

  /** Size multiplier for the short pulse just before a volley. */
  shipPulse(now = this.now): number {
    const ship = this.ship;
    if (!ship || ship.leaving || this.shipGrowth(now) < 1) return 1;
    const t = now - (ship.nextBurst - PULSE_MS);
    return t > 0 && t < PULSE_MS ? 1 + 0.08 * Math.sin((Math.PI * t) / PULSE_MS) : 1;
  }

  /** Everything the text parts around right now. */
  obstacles(): Obstacle[] {
    const centre = this.shipCentre();
    return centre ? [...this.leaves, { ...centre, size: SHIP_SIZE }] : this.leaves;
  }

  /** Whether the point (layout coordinates) is on the logo. */
  hitShip(x: number, y: number): boolean {
    const centre = this.shipCentre();
    return (
      centre != null &&
      !this.ship!.leaving &&
      Math.hypot(x - centre.x, y - centre.y) < SHIP_SIZE * 0.45
    );
  }

  /** Fire a volley now, if the logo has its leaves. Returns whether it fired. */
  fire(now: number): boolean {
    const ship = this.ship;
    if (!ship || ship.leaving || this.shipGrowth(now) < 1) return false;
    if (this.leaves.length > MAX_LEAVES - LEAF_SLOTS.length - EXTRA_LEAVES) return false;
    const centre = this.shipCentre(now)!;
    const tilt = this.shipTilt();
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const launch = (shape: number, x: number, y: number, angle: number, speed: number) => {
      const spinSign = this.random() < 0.5 ? -1 : 1;
      return {
        shape,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        fall: 110 + this.random() * 50,
        rotation: tilt,
        spin: spinSign * (4 + this.random() * 3),
        restSpin: spinSign * (0.4 + this.random() * 0.5),
        sway: 25 + this.random() * 25,
        swayPhase: this.random() * Math.PI * 2,
      };
    };
    for (let shape = 0; shape < LEAF_SLOTS.length; shape++) {
      const slot = LEAF_SLOTS[shape];
      const dx = slot.dx * cos - slot.dy * sin;
      const dy = slot.dx * sin + slot.dy * cos;
      const angle = Math.atan2(dy, dx) + (this.random() - 0.5) * 0.6;
      this.leaves.push({
        ...launch(shape, centre.x + dx, centre.y + dy, angle, 420 + this.random() * 160),
        size: slot.size,
        targetSize: FLIGHT_SIZES[(shape + this.volleys) % FLIGHT_SIZES.length],
      });
    }
    for (let i = 0; i < EXTRA_LEAVES; i++) {
      const angle = this.random() * Math.PI * 2;
      const size = EXTRA_SIZES[i % EXTRA_SIZES.length];
      const shape = (this.volleys + i) % LEAF_SHAPES.length;
      this.leaves.push({
        ...launch(shape, centre.x, centre.y, angle, 300 + this.random() * 160),
        size: size * 0.5,
        targetSize: size,
      });
    }
    this.volleys += 1;
    ship.regrowAt = now + REGROW_DELAY_MS;
    ship.nextBurst = now + BURST_EVERY_MS + this.random() * BURST_JITTER_MS;
    return true;
  }

  /** Where the text starts in the view (it can start below a banner at the
   * top of the article), px from the top of the view. */
  private textTopInView() {
    return Math.min(Math.max(0, -this.top), Math.max(0, this.height - SHIP_SIZE));
  }

  /** A new spot to drift to, over the middle of the text that is on screen. */
  private pickTarget(ship: Mothership, now: number) {
    const from = this.textTopInView();
    ship.targetX = this.width * (0.25 + this.random() * 0.5);
    ship.targetY = from + (this.height - from) * (0.25 + this.random() * 0.5);
    ship.retargetAt = now + 6000;
  }

  /** Advance to `now`. While `active` the logo flies and fires; otherwise it
   * flies up off the page and the leaves already out finish their fall. */
  step(now: number, active = true) {
    const dt = this.last == null ? 0 : Math.min(50, Math.max(0, now - this.last)) / 1000;
    this.last = now;
    this.now = now;

    if (active && (!this.ship || this.ship.leaving)) {
      const ship: Mothership = this.ship ?? {
        x: this.width * 0.5,
        y: this.textTopInView() - SHIP_SIZE,
        vx: 0,
        vy: 0,
        targetX: 0,
        targetY: 0,
        retargetAt: 0,
        leaving: false,
        regrowAt: now - REGROW_MS,
        nextBurst: now + FIRST_BURST_MS,
      };
      ship.leaving = false;
      this.ship = ship;
      this.pickTarget(ship, now);
    }
    const ship = this.ship;
    if (ship) {
      if (!active && !ship.leaving) {
        ship.leaving = true;
        ship.targetY = -2 * SHIP_SIZE;
        ship.targetX = ship.x;
      }
      if (!ship.leaving) {
        const near = Math.hypot(ship.targetX - ship.x, ship.targetY - ship.y) < 30;
        // Scrolling can move the text out from under the spot it was heading for.
        const offText = ship.targetY < this.textTopInView() + SHIP_SIZE / 2;
        if (near || offText || now >= ship.retargetAt) this.pickTarget(ship, now);
      }
      const pull = ship.leaving ? SHIP_PULL * 3 : SHIP_PULL;
      ship.vx += ((ship.targetX - ship.x) * pull - ship.vx * SHIP_DAMPING) * dt;
      ship.vy += ((ship.targetY - ship.y) * pull - ship.vy * SHIP_DAMPING) * dt;
      const speed = Math.hypot(ship.vx, ship.vy);
      const max = ship.leaving ? SHIP_MAX_SPEED * 4 : SHIP_MAX_SPEED;
      if (speed > max) {
        ship.vx *= max / speed;
        ship.vy *= max / speed;
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      if (ship.leaving && ship.y < -SHIP_SIZE) this.ship = null;
      else if (!ship.leaving && now >= ship.nextBurst && !this.fire(now)) {
        ship.nextBurst = now + 500;
      }
    }

    const drag = Math.exp(-DRAG * dt);
    const grow = 1 - Math.exp(-5 * dt);
    for (const leaf of this.leaves) {
      leaf.vx *= drag;
      leaf.vy = leaf.fall + (leaf.vy - leaf.fall) * drag;
      leaf.spin = leaf.restSpin + (leaf.spin - leaf.restSpin) * drag;
      leaf.size += (leaf.targetSize - leaf.size) * grow;
      // Sway only once the launch has worn off and the leaf is falling.
      const launchSpeed = Math.hypot(leaf.vx, leaf.vy - leaf.fall);
      const sway = leaf.sway * Math.cos(now / 700 + leaf.swayPhase) * Math.exp(-launchSpeed / 80);
      leaf.x += (leaf.vx + sway) * dt;
      leaf.y += leaf.vy * dt;
      leaf.rotation += leaf.spin * dt;
    }
    this.leaves = this.leaves.filter(
      (leaf) =>
        leaf.y < this.top + this.height + 2 * leaf.size &&
        leaf.y > this.top - this.height &&
        leaf.x > -2 * leaf.size &&
        leaf.x < this.width + 2 * leaf.size,
    );
  }

  clear() {
    this.leaves = [];
    this.ship = null;
    this.last = null;
  }
}
