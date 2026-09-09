import { describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from '@remix-run/router';
import { createHydrationGuard, documentPath } from '../app/utils/hydration-guard';

function fixture(
  serverPath: string | null = '/disabled',
  initialHref = 'https://example.test/disabled',
) {
  let href = initialHref;
  let attempt: string | null = null;
  let listener: (() => void) | undefined;
  const reload = vi.fn(() => href);
  const onBlocked = vi.fn();
  const unlisten = vi.fn(() => {
    listener = undefined;
  });
  const environment = {
    href: () => href,
    reload,
    readAttempt: vi.fn(() => attempt),
    writeAttempt: vi.fn((value: string) => {
      attempt = value;
    }),
    clearAttempt: vi.fn(() => {
      attempt = null;
    }),
    listen: (fn: () => void) => {
      listener = fn;
      return unlisten;
    },
    onBlocked,
  };
  return {
    environment,
    create: () => createHydrationGuard(serverPath, environment),
    setHref: (value: string) => {
      href = value;
    },
    navigate: (value: string) => {
      href = value;
      listener?.();
    },
    setAttempt: (value: string) => {
      attempt = value;
    },
    reload,
    onBlocked,
    unlisten,
  };
}

describe('article startup navigation guard', () => {
  it('hydrates a matching document without reloading', () => {
    const f = fixture();
    const guard = f.create();
    expect(guard.check()).toBe('hydrate');
    expect(guard.complete()).toBe('hydrate');
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.unlisten).toHaveBeenCalledOnce();
  });

  it('recovers when Back changed the path before JavaScript loaded', () => {
    const f = fixture('/disabled', 'https://example.test/?view=paper#alpha');
    const guard = f.create();
    expect(guard.check()).toBe('reload');
    expect(f.reload).toHaveBeenCalledOnce();
    expect(f.reload.mock.results[0].value).toBe('https://example.test/?view=paper#alpha');
    expect(guard.check()).toBe('reload');
    expect(guard.complete()).toBe('reload');
    expect(f.reload).toHaveBeenCalledOnce();
  });

  it('rechecks when navigation happens between scheduling and rendering', () => {
    const f = fixture();
    const guard = f.create();
    expect(guard.check()).toBe('hydrate');
    f.setHref('https://example.test/');
    expect(guard.check()).toBe('reload');
  });

  it('handles a popstate/pageshow event during startup', () => {
    const f = fixture();
    const guard = f.create();
    f.navigate('https://example.test/second');
    expect(guard.check()).toBe('reload');
    expect(f.unlisten).toHaveBeenCalledOnce();
  });

  it('rechecks immediately before marking hydration complete', () => {
    const f = fixture();
    const guard = f.create();
    f.setHref('https://example.test/third');
    expect(guard.complete()).toBe('reload');
    expect(f.environment.clearAttempt).not.toHaveBeenCalled();
  });

  it('ignores ordinary navigation after hydration and repeated StrictMode effects', () => {
    const f = fixture();
    const guard = f.create();
    guard.complete();
    f.navigate('https://example.test/third');
    expect(guard.complete()).toBe('hydrate');
    expect(guard.check()).toBe('hydrate');
    expect(f.reload).not.toHaveBeenCalled();
    expect(f.environment.clearAttempt).toHaveBeenCalledOnce();
  });

  it('ignores hash-only navigation', () => {
    const f = fixture();
    const guard = f.create();
    f.navigate('https://example.test/disabled#section-2');
    expect(guard.check()).toBe('hydrate');
    expect(f.reload).not.toHaveBeenCalled();
  });

  it.each(['/paper?x=2', '/other?x=1'])('detects a changed path/query: %s', (path) => {
    const f = fixture('/paper?x=1', `https://example.test${path}`);
    expect(f.create().check()).toBe('reload');
  });

  it('retains base paths and encoded characters', () => {
    const path = '/publications/paper%20one?q=a%2Fb';
    const f = fixture(path, `https://example.test${path}#eq-1`);
    expect(f.create().check()).toBe('hydrate');
    expect(documentPath(`https://example.test${path}#eq-1`)).toBe(path);
  });

  it('accepts relocated static HTML without a build-time URL marker', () => {
    const f = fixture(null, 'https://example.test/prefix/article.html?view=1');
    const guard = f.create();
    expect(guard.check()).toBe('hydrate');
    f.navigate('https://example.test/prefix/article.html?view=1#section');
    expect(guard.check()).toBe('hydrate');
    f.navigate('https://example.test/prefix/other.html');
    expect(guard.check()).toBe('reload');
  });

  it('stops a stale-response reload loop across document instances', () => {
    const f = fixture('/disabled', 'https://example.test/');
    expect(f.create().check()).toBe('reload');
    expect(f.create().check()).toBe('blocked');
    expect(f.reload).toHaveBeenCalledOnce();
  });

  it('clears the recorded attempt once the correct page is initialized', () => {
    const f = fixture();
    f.setAttempt('/disabled');
    f.create().complete();
    expect(f.environment.readAttempt()).toBeNull();
  });

  it('offers manual recovery when repeated navigation cannot recover', () => {
    const f = fixture();
    f.setAttempt('/');
    const guard = f.create();
    f.navigate('https://example.test/');
    expect(guard.check()).toBe('blocked');
    expect(f.onBlocked).toHaveBeenCalledOnce();
    guard.resetRecovery();
    expect(f.environment.readAttempt()).toBeNull();
    expect(f.reload).not.toHaveBeenCalled();
  });

  it.each(['readAttempt', 'writeAttempt'] as const)(
    'does not loop if storage %s throws',
    (method) => {
      const f = fixture('/disabled', 'https://example.test/');
      f.environment[method].mockImplementation(() => {
        throw new Error('Storage denied');
      });
      expect(f.create().check()).toBe('blocked');
      expect(f.reload).not.toHaveBeenCalled();
    },
  );

  it('detects silently discarded recovery storage writes', () => {
    const f = fixture('/disabled', 'https://example.test/');
    f.environment.writeAttempt.mockImplementation(() => {});
    expect(f.create().check()).toBe('blocked');
    expect(f.reload).not.toHaveBeenCalled();
  });

  it('still hydrates normally if storage is unavailable', () => {
    const f = fixture();
    f.environment.clearAttempt.mockImplementation(() => {
      throw new Error('Storage denied');
    });
    expect(f.create().complete()).toBe('hydrate');
    expect(f.reload).not.toHaveBeenCalled();
  });

  it('stops automatic retries if reloading throws', () => {
    const f = fixture('/disabled', 'https://example.test/');
    f.reload.mockImplementation(() => {
      throw new Error('Navigation failed');
    });
    const guard = f.create();
    expect(guard.check()).toBe('blocked');
    expect(guard.check()).toBe('blocked');
    expect(f.reload).toHaveBeenCalledOnce();
  });
});

describe('regression: old router trusts mismatched hydration data', () => {
  it('rejects the old document before its missing route module can be rendered', () => {
    const loaded = new Set(['root', 'other']);
    const loader = vi.fn(() => null);
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
      routes: [
        {
          id: 'root',
          path: '/',
          loader,
          children: [
            { id: 'index', index: true, loader },
            { id: 'other', path: '*', loader },
          ],
        },
      ],
      hydrationData: { loaderData: { root: {}, other: {} } },
    }).initialize();
    expect(router.state.initialized).toBe(true);
    expect(
      router.state.matches.filter((m) => !loaded.has(m.route.id)).map((m) => m.route.id),
    ).toEqual(['index']);
    expect(loader).not.toHaveBeenCalled();
    expect(fixture('/disabled', 'https://example.test/').create().check()).toBe('reload');
    router.dispose();
  });
});
