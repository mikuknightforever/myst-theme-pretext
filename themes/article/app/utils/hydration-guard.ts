export const HYDRATION_RECOVERY_KEY = 'myst:hydration-recovery';

export type StartupResult = 'hydrate' | 'reload' | 'blocked';

type StartupEnvironment = {
  href: () => string;
  reload: () => void;
  readAttempt: () => string | null;
  writeAttempt: (path: string) => void;
  clearAttempt: () => void;
  listen: (onNavigation: () => void) => () => void;
  onBlocked: () => void;
};

/** Hash changes do not invalidate server data. Paths, query strings and base paths do. */
export function documentPath(href: string): string {
  const url = new URL(href);
  return url.pathname + url.search;
}

/** Keep old SSR data away from a new URL until the router has committed its first render. */
export function createHydrationGuard(serverPath: string | null, environment: StartupEnvironment) {
  // Static exports can be relocated or renamed by the host. Without an SSR marker,
  // capture the actual served path, rather than comparing against a build-time URL.
  const expectedPath = serverPath ?? documentPath(environment.href());
  let phase: 'pending' | 'ready' | 'reload' | 'blocked' = 'pending';
  let stopListening = () => {};

  function resetRecovery() {
    try {
      environment.clearAttempt();
    } catch {
      // Storage is optional for ordinary hydration and explicit manual retries.
    }
  }

  function check(): StartupResult {
    if (phase === 'ready') return 'hydrate';
    if (phase !== 'pending') return phase;
    const currentHref = environment.href();
    const currentPath = documentPath(currentHref);
    if (currentPath === expectedPath) return 'hydrate';

    // Persist the attempt across the replacement document. A stale cached response
    // must not cause an automatic reload loop. If storage is unavailable, fail closed
    // to a manual recovery page instead of guessing that automatic recovery is safe.
    phase = 'blocked';
    stopListening();
    try {
      if (environment.readAttempt() === currentPath) return 'blocked';
      environment.writeAttempt(currentPath);
      if (environment.readAttempt() !== currentPath) return 'blocked';
      phase = 'reload';
      // Reload the browser's current history entry, preserving its query and hash.
      // location.replace(currentHref) is NOT equivalent: with a fragment it can
      // perform only an anchor navigation and leave the stale document in place.
      environment.reload();
    } catch {
      phase = 'blocked';
    }
    return phase;
  }

  function complete(): StartupResult {
    const result = check();
    if (result === 'hydrate' && phase === 'pending') {
      phase = 'ready';
      stopListening();
      resetRecovery();
    }
    return result;
  }

  stopListening = environment.listen(() => {
    if (check() === 'blocked') environment.onBlocked();
  });

  return { check, complete, resetRecovery };
}
