/** One object that knows where every word should be drawn right now: click
 * bursts plus cursor springs. The overlay runs a single animation loop that
 * calls beginFrame() and notifies the layers, which ask motion() per word. */
import { combinedOffset, isBurstActive, type Burst } from './explode.js';
import {
  isAtRest,
  magnifyScale,
  restingSpring,
  SPRING_REACH,
  stepSpring,
  type HoverMode,
  type Spring,
} from './springs.js';

export type EffectMode = 'none' | HoverMode | 'explode';

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
  private viewTop = 0;
  private viewHeight = 800;
  private transition: { start: number; viewTop: number; from: PlacedWord[] } | null = null;

  /** Current scroll position (layout coordinates) and height of the view. */
  setView(top: number, height: number) {
    this.viewTop = top;
    this.viewHeight = height;
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
      this.words.size > 0 ||
      this.bursts.some((burst) => isBurstActive(burst, now)) ||
      (this.transition != null && now - this.transition.start < TRANSITION_MS)
    );
  }

  beginFrame(now: number) {
    this.frame++;
    this.now = now;
    this.bursts = this.bursts.filter((burst) => isBurstActive(burst, now));
    if (this.transition && now - this.transition.start >= TRANSITION_MS) this.transition = null;
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
    const hover = this.mode === 'scatter' || this.mode === 'magnify' ? this.mode : null;
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
      if (hover === 'magnify' && this.cursor) {
        scale = magnifyScale(
          Math.hypot(cx + state.spring.dx - this.cursor.x, cy + state.spring.dy - this.cursor.y),
        );
      }
      if (isAtRest(state.spring) && !near) {
        this.words.delete(index);
        state = undefined;
      }
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
      this.transition != null
    );
  }
}
