import * as React from 'react';
import { DARK } from '../components/palette.js';
import type { FigureRegion } from '../figure-regions.js';
import type { HeadingAnchor } from '../layout/types.js';

/** Context kept around the region, as a share of the image. */
const CROP_MARGIN = 0.015;

/** Display size of a crop that fits the available box, keeping its shape. */
export function cropDisplaySize(
  region: FigureRegion,
  natural: { width: number; height: number },
  available: { width: number; height: number },
): { width: number; height: number; box: [number, number, number, number] } {
  const [rx0, ry0, rx1, ry1] = region.box;
  const box: [number, number, number, number] = [
    Math.max(0, rx0 - CROP_MARGIN),
    Math.max(0, ry0 - CROP_MARGIN),
    Math.min(1, rx1 + CROP_MARGIN),
    Math.min(1, ry1 + CROP_MARGIN),
  ];
  const cropW = (box[2] - box[0]) * natural.width;
  const cropH = (box[3] - box[1]) * natural.height;
  // Never upscale beyond twice the source pixels: past that, it only blurs.
  const scale = Math.min(available.width / cropW, available.height / cropH, 2);
  return { width: Math.round(cropW * scale), height: Math.round(cropH * scale), box };
}

/** An enlarged, legible view of one figure region, with links to the sections
 * that describe it. Esc, the close button or a click outside closes it. */
export function RegionZoom({
  imageUrl,
  figureLabel,
  region,
  headings,
  isDark,
  onGoToSection,
  onClose,
}: {
  imageUrl: string;
  figureLabel: string;
  region: FigureRegion;
  headings: HeadingAnchor[];
  isDark: boolean;
  onGoToSection: (heading: HeadingAnchor) => void;
  onClose: () => void;
}) {
  const [natural, setNatural] = React.useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = React.useState(() => ({
    width: typeof window === 'undefined' ? 1200 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const image = new Image();
    image.onload = () => setNatural({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = imageUrl;
  }, [imageUrl]);
  React.useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    closeRef.current?.focus();
    return () => window.removeEventListener('resize', resize);
  }, []);
  const sections = region.sectionIds
    .map((id) => headings.find((heading) => heading.id === id))
    .filter((heading): heading is HeadingAnchor => !!heading);
  const crop = natural
    ? cropDisplaySize(region, natural, {
        width: Math.min(viewport.width * 0.86, 1180),
        height: viewport.height * 0.6,
      })
    : null;
  const panel = isDark ? DARK.panel : '#ffffff';
  const muted = isDark ? DARK.muted : '#64748b';
  return (
    <div
      className="pretext-region-zoom"
      role="dialog"
      aria-modal="true"
      aria-label={`${region.label}, enlarged`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 300,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          maxWidth: '92vw',
          padding: '16px 18px 18px',
          borderRadius: 16,
          background: panel,
          color: isDark ? DARK.text : '#0f172a',
          boxShadow: '0 24px 60px rgba(15,23,42,0.35)',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: muted }}>{figureLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{region.label}</div>
            {region.description && (
              <div style={{ marginTop: 4, fontSize: 14, color: muted }}>{region.description}</div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close enlarged view"
            title="Close (Esc)"
            style={{
              width: 32,
              height: 32,
              border: 0,
              borderRadius: 999,
              background: isDark ? DARK.chip : 'rgba(15,23,42,0.06)',
              color: 'inherit',
              fontSize: 18,
              lineHeight: '32px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
        <div
          className="pretext-region-crop"
          style={{
            position: 'relative',
            width: crop?.width ?? 480,
            height: crop?.height ?? 270,
            overflow: 'hidden',
            borderRadius: 10,
            background: isDark ? 'rgba(148,163,184,0.1)' : '#f8fafc',
          }}
        >
          {crop && (
            <img
              src={imageUrl}
              alt={region.label}
              draggable={false}
              style={{
                position: 'absolute',
                maxWidth: 'none',
                width: crop.width / (crop.box[2] - crop.box[0]),
                height: crop.height / (crop.box[3] - crop.box[1]),
                left: -(crop.box[0] / (crop.box[2] - crop.box[0])) * crop.width,
                top: -(crop.box[1] / (crop.box[3] - crop.box[1])) * crop.height,
              }}
            />
          )}
        </div>
        {sections.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              fontSize: 13,
            }}
          >
            <span style={{ color: muted }}>Discussed in</span>
            {sections.map((heading) => (
              <button
                key={heading.id}
                type="button"
                onClick={() => onGoToSection(heading)}
                style={{
                  border: 0,
                  borderRadius: 999,
                  padding: '6px 12px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Go to § {heading.title} →
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
