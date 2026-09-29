/** One object that knows where every word should be drawn right now: click
 * bursts plus cursor springs. The overlay runs a single animation loop that
 * calls beginFrame() and notifies the layers, which ask motion() per word. */
import { combinedOffset, isBurstActive, type Burst } from './explode.js';
import { LeafField, leafParting, partRow, type Obstacle } from './leaves.js';
import {
  isAtRest,
  magnifyGrowth,
  restingSpring,
  SPRING_REACH,
  stepSpring,
  type HoverMode,
  type Spring,
} from './springs.js';

export type EffectMode = 'none' | HoverMode | 'explode' | 'leaves';

export interface WordMotion {
  dx: number;
  dy: number;
  /** Radians. */
  rotation: number;
  scale: number;
}

/** A laid-out word, as the transitions need it. */
export interface PlacedWord {
  text: string;
  x: number;
  y: number;
}

export const TRANSITION_MS = 450;
/** Load wave: a front sweeps diagonally across the view and each word it
 * passes stands up and sits back down, like a stadium's Mexican wave. */
export const WAVE_MS = 1300;
const WAVE_SPEED = 2; // px per ms along the front
const WAVE_PASS_MS = 320; // how long one word takes to stand up and sit down
const WAVE_LIFT = 7;
const WAVE_GROWTH = 0.04;

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

interface WordState {
  spring: Spring;
  frame: number;
}

export class EffectsEngine {
  mode: EffectMode = 'none';
  bursts: Burst[] = [];
  private cursor: { x: number; y: number } | null = null;
  private lastCursor: { x: number; y: number } | null = null;
  private speed = 0;
  private frame = 0;
  private now = 0;
  private words = new Map<number, WordState>();
  private listeners = new Set<() => void>();
  /** Magnify lens: eases in while the cursor is over the text, out after it
   * leaves, around the last cursor position. */
  private lens = 0;
  private lensAt: { x: number; y: number } | null = null;
  private wave: { start: number } | null = null;
  private viewTop = 0;
  private viewHeight = 800;
  /** The floating logo and its leaves (leaves mode); layout coordinates. */
  readonly leafField = new LeafField();
  /** What the text parts around this frame. */
  private obstacles: Obstacle[] = [];
  /** The laid-out words grouped into rows (left to right), so a row can part
   * as a whole; widths are learned as words are drawn. */
  private wordsRef: ReadonlyArray<PlacedWord> = [];
  private rowOf: Int32Array = new Int32Array(0);
  private rows: number[][] = [];
  private widths = new Map<number, number>();
  private rowOffsets = new Map<number, { frame: number; offsets: Map<number, number> }>();
  private transition: { start: number; viewTop: number; from: PlacedWord[] } | null = null;

  /** Current scroll position (layout coordinates) and height of the view. */
  setView(top: number, height: number, width?: number) {
    this.viewTop = top;
    this.viewHeight = height;
    this.leafField.setView(top, height, width ?? 1000);
  }

  /** The laid-out words, in reading order (the same indices `motion` gets). */
  setWords(words: ReadonlyArray<PlacedWord>) {
    this.rowOf = new Int32Array(words.length);
    this.rows = [];
    this.widths.clear();
    this.rowOffsets.clear();
    let row: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const previous = row.length ? words[row[row.length - 1]] : null;
      if (previous && (Math.abs(words[i].y - previous.y) > 0.5 || words[i].x <= previous.x)) {
        this.rows.push(row);
        row = [];
      }
      row.push(i);
      this.rowOf[i] = this.rows.length;
    }
    if (row.length) this.rows.push(row);
    this.wordsRef = words;
  }

  /** Offsets for every word on the row of word `index`, parted as a whole. */
  private rowParting(index: number, cy: number): Map<number, number> | null {
    const rowId = this.rowOf[index];
    const row = this.rows[rowId];
    if (!row || this.wordsRef[index] == null) return null;
    const cached = this.rowOffsets.get(rowId);
    if (cached && cached.frame === this.frame) return cached.offsets;
    const lefts = row.map((i) => this.wordsRef[i].x);
    const widths = row.map((i, k) => {
      const known = this.widths.get(i);
      if (known != null) return known;
      // Not drawn yet this layout: assume a normal space before the next word.
      return k + 1 < row.length ? Math.max(1, lefts[k + 1] - lefts[k] - 4) : 50;
    });
    const desired = row.map((_, k) => leafParting(lefts[k] + widths[k] / 2, cy, this.obstacles));
    const offsets = new Map<number, number>();
    if (desired.some((value) => value !== 0)) {
      const parted = partRow(lefts, widths, desired);
      row.forEach((i, k) => {
        if (Math.abs(parted[k]) >= 0.05) offsets.set(i, parted[k]);
      });
    }
    this.rowOffsets.set(rowId, { frame: this.frame, offsets });
    return offsets;
  }

  /** Start the load wave over the text now on screen. */
  startWave(now: number) {
    this.wave = { start: now };
  }

  /** Before a relayout (e.g. a column change): remember where every word was
   * on screen, so each can move from there to its new place. */
  startTransition(words: PlacedWord[], now: number) {
    this.transition = {
      start: now,
      viewTop: this.viewTop,
      from: words.map(({ text, x, y }) => ({ text, x, y })),
    };
  }

  pointer(x: number, y: number) {
    this.cursor = { x, y };
  }

  pointerLeave() {
    this.cursor = null;
  }

  addBurst(burst: Burst) {
    this.bursts = [...this.bursts, burst];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    for (const listener of this.listeners) listener();
  }

  /** Whether anything is moving (or could move) at `now`. */
  isActive(now: number): boolean {
    const hover = this.mode === 'scatter' || this.mode === 'magnify';
    return (
      (hover && this.cursor != null) ||
      this.lens > 0 ||
      this.words.size > 0 ||
      this.mode === 'leaves' ||
      this.leafField.leaves.length > 0 ||
      this.leafField.ship != null ||
      this.bursts.some((burst) => isBurstActive(burst, now)) ||
      (this.transition != null && now - this.transition.start < TRANSITION_MS) ||
      (this.wave != null && now - this.wave.start < WAVE_MS)
    );
  }

  beginFrame(now: number) {
    this.frame++;
    this.now = now;
    this.bursts = this.bursts.filter((burst) => isBurstActive(burst, now));
    if (this.transition && now - this.transition.start >= TRANSITION_MS) this.transition = null;
    if (this.wave && now - this.wave.start >= WAVE_MS) this.wave = null;
    if (this.cursor && this.lastCursor) {
      const moved = Math.hypot(
        this.cursor.x - this.lastCursor.x,
        this.cursor.y - this.lastCursor.y,
      );
      this.speed = this.speed * 0.7 + moved * 0.3;
    } else {
      this.speed *= 0.9;
    }
    this.lastCursor = this.cursor;
    // After leaves mode is turned off the logo flies away and the leaves
    // already out finish their fall.
    if (this.mode === 'leaves' || this.leafField.leaves.length || this.leafField.ship) {
      this.leafField.step(now, this.mode === 'leaves');
    }
    this.obstacles = this.leafField.obstacles();
    const lensOn = this.mode === 'magnify' && this.cursor != null;
    if (lensOn) this.lensAt = this.cursor;
    this.lens += ((lensOn ? 1 : 0) - this.lens) * 0.2;
    if (!lensOn && this.lens < 0.01) {
      this.lens = 0;
      this.lensAt = null;
    }
  }

  /** Motion for the word at `index` whose laid-out centre is (cx, cy). */
  motion(index: number, cx: number, cy: number, word?: PlacedWord): WordMotion | null {
    const burst = this.bursts.length ? combinedOffset(cx, cy, index, this.bursts, this.now) : null;
    let tx = 0;
    let ty = 0;
    const from = word && this.transition?.from[index];
    if (word && from && from.text === word.text) {
      const p = (this.now - this.transition!.start) / TRANSITION_MS;
      // Keep the word where it was on screen, even if the view scrolled.
      const offsetY = from.y - this.transition!.viewTop + this.viewTop - word.y;
      if (p < 1 && Math.abs(offsetY) < this.viewHeight * 1.5) {
        const remaining = 1 - easeOutCubic(Math.max(0, p));
        tx = (from.x - word.x) * remaining;
        ty = offsetY * remaining;
      }
    }
    // Scatter uses springs; magnify is a lens computed from the cursor directly.
    const hover = this.mode === 'scatter' ? this.mode : null;
    let state = this.words.get(index);
    const near =
      hover != null &&
      this.cursor != null &&
      Math.abs(cx - this.cursor.x) < SPRING_REACH &&
      Math.abs(cy - this.cursor.y) < SPRING_REACH;
    if (!state && near) {
      state = { spring: restingSpring(), frame: -1 };
      this.words.set(index, state);
    }
    let scale = 1;
    if (state) {
      if (state.frame !== this.frame) {
        state.spring = stepSpring(
          state.spring,
          { x: cx, y: cy },
          hover ? this.cursor : null,
          this.speed,
          hover ?? 'scatter',
        );
        state.frame = this.frame;
      }
      if (isAtRest(state.spring) && !near) {
        this.words.delete(index);
        state = undefined;
      }
    }
    if (word && this.wave) {
      const viewY = word.y - this.viewTop;
      if (viewY > -50 && viewY < this.viewHeight + 50) {
        const local = this.now - this.wave.start - (word.x * 0.5 + Math.max(0, viewY)) / WAVE_SPEED;
        if (local > 0 && local < WAVE_PASS_MS) {
          const up = Math.sin((Math.PI * local) / WAVE_PASS_MS);
          ty -= WAVE_LIFT * up;
          scale *= 1 + WAVE_GROWTH * up;
        }
      }
    }
    if (this.obstacles.length) {
      // The whole row parts together, so words never run into each other or
      // past the edge of the text.
      if (word) this.widths.set(index, 2 * (cx - word.x));
      const row = word ? this.rowParting(index, cy) : null;
      tx += row ? (row.get(index) ?? 0) : leafParting(cx, cy, this.obstacles);
    }
    if (this.lens > 0 && this.lensAt) {
      // Words grow in place, each only as far as its gaps allow (no squeezing).
      const width = word ? 2 * (cx - word.x) : undefined;
      const growth = magnifyGrowth(Math.hypot(cx - this.lensAt.x, cy - this.lensAt.y), width);
      if (growth > 0) scale *= 1 + growth * this.lens;
    }
    if (!burst && !state && scale === 1 && tx === 0 && ty === 0) return null;
    return {
      dx: (burst?.dx ?? 0) + (state?.spring.dx ?? 0) + tx,
      dy: (burst?.dy ?? 0) + (state?.spring.dy ?? 0) + ty,
      rotation: burst?.rotation ?? 0,
      scale,
    };
  }

  /** Cheap check before asking every word: is any effect possibly on? */
  get anyMotion(): boolean {
    return (
      this.bursts.length > 0 ||
      this.words.size > 0 ||
      this.cursor != null ||
      this.lens > 0 ||
      this.obstacles.length > 0 ||
      this.transition != null ||
      this.wave != null
    );
  }
}
