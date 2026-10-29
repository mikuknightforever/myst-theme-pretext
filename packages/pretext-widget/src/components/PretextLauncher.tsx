import * as React from 'react';
import { DARK } from './palette.js';
import { createPortal } from 'react-dom';
import { DEFAULT_TEXT_STYLE } from '../layout.js';
import {
  browserStorage,
  LAUNCHER_HINT_SEEN_KEY,
  loadStoredFlag,
  saveStoredFlag,
  WELCOME_SEEN_KEY,
} from '../preferences.js';
import { PretextTour, TOUR_ATTRIBUTE, tourRequested, type TourStep } from './PretextTour.js';

const LAUNCHER_STEP: TourStep = {
  target: 'launcher',
  title: 'Text that breaks its mould',
  body: 'Rearrange the layout on the fly, your way.',
  credit: { before: 'Powered by', label: 'Pretext', href: 'https://github.com/chenglou/pretext' },
};
const LAUNCHER_STEPS = [LAUNCHER_STEP];

/** Whether to point the reader at the Pretext button: on a first visit (until
 * they open the reader or dismiss the hint), and always for a ?tour link. */
export function shouldShowLauncherHint(
  storage: Parameters<typeof loadStoredFlag>[0],
  search: string,
): boolean {
  if (tourRequested(search)) return true;
  return !loadStoredFlag(storage, LAUNCHER_HINT_SEEN_KEY) && !loadStoredFlag(storage, WELCOME_SEEN_KEY);
}

/** How long the article page settles before the hint appears. */
const HINT_DELAY_MS = 1200;

/** A spotlight on the Pretext button, over the article page. */
function LauncherHint({ isDark, onOpen }: { isDark: boolean; onOpen: () => void }) {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!shouldShowLauncherHint(browserStorage(), window.location.search)) return;
    const timer = window.setTimeout(() => setShow(true), HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  const dismiss = React.useCallback(() => {
    saveStoredFlag(browserStorage(), LAUNCHER_HINT_SEEN_KEY, true);
    setShow(false);
  }, []);
  if (!show) return null;
  // On the body, so the theme header's stacking cannot trap the dimmed layer.
  return createPortal(
    <PretextTour
      root={document.body}
      isDark={isDark}
      steps={LAUNCHER_STEPS}
      doneLabel="Read in Pretext"
      skipLabel="Not now"
      onDone={() => {
        dismiss();
        onOpen();
      }}
      onClose={dismiss}
      zIndex={2147483000}
    />,
    document.body,
  );
}

/** A theme can place this element next to its own buttons (e.g. the theme
 * switcher); the icon launcher is drawn into it. */
export const PRETEXT_LAUNCHER_SLOT_ID = 'pretext-launcher-slot';

function FlaskIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="100%"
      height="100%"
      aria-hidden="true"
      style={{ padding: '22%' }}
    >
      <path
        d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.2 15h9.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Round icon button matching the theme switcher; no space taken in the article. */
function IconLauncher({ isDark, onOpen }: { isDark: boolean; onOpen: () => void }) {
  const [slot, setSlot] = React.useState<HTMLElement | null | undefined>(undefined);
  // Opening the reader, from the button or the hint, ends the hint for good.
  const [hintDone, setHintDone] = React.useState(false);
  const open = React.useCallback(() => {
    saveStoredFlag(browserStorage(), LAUNCHER_HINT_SEEN_KEY, true);
    setHintDone(true);
    onOpen();
  }, [onOpen]);
  React.useEffect(() => {
    setSlot(document.getElementById(PRETEXT_LAUNCHER_SLOT_ID));
  }, []);
  if (slot === undefined) return null; // not mounted yet (and during server rendering)
  const label = 'Open Pretext Mode';
  const button = (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      title={label}
      data-pretext-entry="automatic"
      {...{ [TOUR_ATTRIBUTE]: 'launcher' }}
      style={{
        width: 40,
        height: 40,
        margin: slot ? '0 0 0 12px' : 0,
        padding: 0,
        flexShrink: 0,
        borderRadius: 999,
        border: `1px solid ${isDark ? '#ffffff' : '#44403c'}`,
        background: 'transparent',
        color: isDark ? '#ffffff' : '#44403c',
        cursor: 'pointer',
        ...(slot ? {} : { position: 'fixed' as const, top: 16, right: 80, zIndex: 50 }),
      }}
    >
      <FlaskIcon />
    </button>
  );
  return (
    <>
      {slot ? createPortal(button, slot) : button}
      {!hintDone && <LauncherHint isDark={isDark} onOpen={open} />}
    </>
  );
}

export function PretextLauncher({
  blockCount,
  figureCount,
  isDark,
  onOpen,
  variant = 'card',
}: {
  blockCount: number;
  figureCount: number;
  isDark: boolean;
  onOpen: () => void;
  /** `icon` for the automatic entry; `card` for a directive the author placed. */
  variant?: 'icon' | 'card';
}) {
  if (variant === 'icon') return <IconLauncher isDark={isDark} onOpen={onOpen} />;
  return (
    <section
      style={{
        margin: '1.5rem 0',
        padding: '18px 20px',
        borderRadius: 18,
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.38)' : 'rgba(148,163,184,0.28)'}`,
        background: isDark ? DARK.panelTranslucent : 'rgba(248,250,252,0.92)',
        fontFamily: DEFAULT_TEXT_STYLE.fontFamily,
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 18,
          fontWeight: 800,
          color: isDark ? DARK.white : '#111827',
        }}
      >
        Pretext Mode
      </p>
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 14,
          lineHeight: 1.6,
          color: isDark ? DARK.muted : '#475569',
        }}
      >
        {figureCount > 0
          ? `Found ${figureCount} draggable figure${figureCount !== 1 ? 's' : ''}. Open Pretext Mode to drag them — text reflows around all figures simultaneously.`
          : 'Open Pretext Mode to read this article in adjustable columns.'}
      </p>
      {blockCount === 0 && (
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>
          (No article content found in MDAST.)
        </p>
      )}
      <button
        type="button"
        onClick={onOpen}
        style={{
          border: `1px solid ${isDark ? 'rgba(226,232,240,0.3)' : 'rgba(15,23,42,0.18)'}`,
          borderRadius: 999,
          padding: '10px 16px',
          background: isDark ? DARK.white : '#111827',
          color: isDark ? DARK.page : '#fff',
          fontWeight: 800,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Open Pretext Mode
      </button>
    </section>
  );
}
