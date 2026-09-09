import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode, useEffect } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { createHydrationGuard, HYDRATION_RECOVERY_KEY } from './utils/hydration-guard';

let root: Root | undefined;
const guard = createHydrationGuard(
  document.querySelector('meta[name="myst-document-path"]')?.getAttribute('content') ?? null,
  {
    href: () => window.location.href,
    reload: () => window.location.reload(),
    readAttempt: () => window.sessionStorage.getItem(HYDRATION_RECOVERY_KEY),
    writeAttempt: (path) => window.sessionStorage.setItem(HYDRATION_RECOVERY_KEY, path),
    clearAttempt: () => window.sessionStorage.removeItem(HYDRATION_RECOVERY_KEY),
    listen: (onNavigation) => {
      window.addEventListener('popstate', onNavigation);
      window.addEventListener('pageshow', onNavigation);
      return () => {
        window.removeEventListener('popstate', onNavigation);
        window.removeEventListener('pageshow', onNavigation);
      };
    },
    onBlocked: showRecovery,
  },
);

function RecoveryDocument() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Reload this article</title>
      </head>
      <body style={{ margin: 40, fontFamily: 'system-ui', lineHeight: 1.6 }}>
        <main>
          <h1>This page changed while it was starting</h1>
          <p>
            The saved page could not be matched to the current address. Automatic recovery stopped
            to avoid repeated reloads.
          </p>
          <button
            type="button"
            onClick={() => {
              guard.resetRecovery();
              window.location.reload();
            }}
          >
            Reload current page
          </button>
        </main>
      </body>
    </html>
  );
}

function showRecovery() {
  root ??= createRoot(document);
  root.render(<RecoveryDocument />);
}

function HydratedApp() {
  // React can schedule this render after hydrateRoot returns. Recheck immediately
  // before Remix constructs its browser router, not just when this script loads.
  const result = guard.check();
  useEffect(() => {
    if (guard.complete() === 'blocked') showRecovery();
  }, []);
  if (result === 'blocked') return <RecoveryDocument />;
  if (result === 'reload') return null;
  return <RemixBrowser />;
}

// Navigation is startup-critical; do not defer it to an unbounded idle callback.
const result = guard.check();
if (result === 'hydrate') {
  startTransition(() => {
    root = hydrateRoot(
      document,
      <StrictMode>
        <HydratedApp />
      </StrictMode>,
    );
  });
} else if (result === 'blocked') {
  showRecovery();
}
