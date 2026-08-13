import * as React from 'react';
import type { FigureInfo } from './model.js';

export function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) {
        const next = Math.round(w);
        setWidth((current) => (current === next ? current : next));
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  React.useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

export function useImageRatios(figures: FigureInfo[]): Record<number, number> {
  const [imageRatios, setImageRatios] = React.useState<Record<number, number>>({});
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const missing = figures
      .map((fig, index) => ({ fig, index }))
      .filter(({ fig, index }) => fig.imageUrl && !imageRatios[index]);
    if (missing.length === 0) return undefined;
    Promise.all(
      missing.map(
        ({ fig, index }) =>
          new Promise<{ index: number; ratio: number | null }>((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                resolve({ index, ratio: null });
                return;
              }
              resolve({ index, ratio: img.naturalHeight / img.naturalWidth });
            };
            img.onerror = () => resolve({ index, ratio: null });
            img.src = fig.imageUrl as string;
          }),
      ),
    ).then((loaded) => {
      if (cancelled) return;
      setImageRatios((current) => {
        let changed = false;
        const next = { ...current };
        for (const { index, ratio } of loaded) {
          if (!ratio || current[index] === ratio) continue;
          next[index] = ratio;
          changed = true;
        }
        return changed ? next : current;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [figures, imageRatios]);
  return imageRatios;
}
