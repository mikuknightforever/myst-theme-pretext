/** Leaves effect: the Evidence logo's leaves fall through the text, and each
 * row they cross parts around them (words slide aside to both sides and close
 * back behind the leaf). Line breaks never change; this only offsets drawing. */
import { LEAF_SHAPES } from './leaf-shapes.js';

export interface Leaf {
  /** Index into LEAF_SHAPES. */
  shape: number;
  /** Size of the leaf's longer side, px. */
  size: number;
  /** Centre, in layout (content) coordinates. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Radians, and radians per second. */
  rotation: number;
  spin: number;
  /** Side-to-side drift speed, px per second, and its phase. */
  sway: number;
  swayPhase: number;
}

export const MAX_LEAVES = 6;
const SIZES = [58, 36, 48, 30];
const SPAWN_EVERY_MS = 1200;
const SPAWN_JITTER_MS = 1000;
/** Leaves stay between these fractions of the width, so words beside a leaf are
 * never pushed past the edge of the text. */
const EDGE_MIN = 0.15;
const EDGE_MAX = 0.85;

/** Horizontal offset for the word centred at (cx, cy): words beside a leaf are
 * pushed away from it, most strongly next to it, fading along the row and over
 * the rows above and below. Smooth everywhere and gentle enough that words on a
 * row never swap order, so a word slides aside and back as a leaf falls past. */
export function leafParting(cx: number, cy: number, leaves: Leaf[]): number {
  let offset = 0;
  for (const leaf of leaves) {
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

/** The falling leaves: spawns them above the view and moves them each frame. */
export class LeafField {
  leaves: Leaf[] = [];
  /** Shapes and sizes in spawn order (for tests and cycling). */
  spawnedShapes: number[] = [];
  spawnedSizes: number[] = [];
  private top = 0;
  private height = 800;
  private width = 1000;
  private last: number | null = null;
  private nextSpawn = 0;
  private count = 0;

  constructor(private readonly random: () => number = Math.random) {}

  setView(top: number, height: number, width: number) {
    this.top = top;
    this.height = height;
    this.width = width;
  }

  /** Advance to `now`; new leaves appear only while `spawn` is true. */
  step(now: number, spawn = true) {
    const dt = this.last == null ? 0 : Math.min(50, Math.max(0, now - this.last)) / 1000;
    this.last = now;
    for (const leaf of this.leaves) {
      leaf.x += (leaf.vx + leaf.sway * Math.cos(now / 700 + leaf.swayPhase)) * dt;
      leaf.y += leaf.vy * dt;
      leaf.rotation += leaf.spin * dt;
      if (leaf.x < this.width * EDGE_MIN) {
        leaf.x = this.width * EDGE_MIN;
        leaf.vx = Math.abs(leaf.vx);
      } else if (leaf.x > this.width * EDGE_MAX) {
        leaf.x = this.width * EDGE_MAX;
        leaf.vx = -Math.abs(leaf.vx);
      }
    }
    this.leaves = this.leaves.filter(
      (leaf) =>
        leaf.y < this.top + this.height + 2 * leaf.size && leaf.y > this.top - 4 * leaf.size,
    );
    if (spawn && now >= this.nextSpawn && this.leaves.length < MAX_LEAVES) {
      const shape = this.count % LEAF_SHAPES.length;
      const size = SIZES[this.count % SIZES.length];
      this.count += 1;
      this.spawnedShapes.push(shape);
      this.spawnedSizes.push(size);
      this.leaves.push({
        shape,
        size,
        x: this.width * (0.2 + this.random() * 0.6),
        y: this.top - size,
        vx: (this.random() - 0.5) * 60,
        vy: 60 + this.random() * 30,
        rotation: this.random() * Math.PI * 2,
        spin: (this.random() - 0.5) * 1.4,
        sway: 25 + this.random() * 25,
        swayPhase: this.random() * Math.PI * 2,
      });
      this.nextSpawn = now + SPAWN_EVERY_MS + this.random() * SPAWN_JITTER_MS;
    }
  }

  clear() {
    this.leaves = [];
    this.last = null;
  }
}
