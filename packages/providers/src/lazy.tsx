import React, { useContext, useEffect, useState } from 'react';

/**
 * Whether figures and notebook outputs wait until they are near the screen
 * before loading. On by default. A view that lays out every figure up front,
 * and so needs their real sizes at once, turns it off for its subtree.
 */
const LazyLoadingContext = React.createContext<boolean>(true);

export function LazyLoadingProvider({
  lazy,
  children,
}: {
  lazy: boolean;
  children: React.ReactNode;
}) {
  return <LazyLoadingContext.Provider value={lazy}>{children}</LazyLoadingContext.Provider>;
}

export function useLazyLoading(): boolean {
  return useContext(LazyLoadingContext);
}

/** How far outside the screen an element starts loading. */
const NEAR_SCREEN_MARGIN = '1200px 0px';

/**
 * True once the element has come within NEAR_SCREEN_MARGIN of the screen, and
 * from then on. True from the start when lazy loading is off, or when the
 * browser has no IntersectionObserver.
 */
export function useNearScreen<T extends Element>(ref: React.RefObject<T | null>): boolean {
  const lazy = useLazyLoading();
  const [near, setNear] = useState(
    () => !lazy || (typeof window !== 'undefined' && !('IntersectionObserver' in window)),
  );
  useEffect(() => {
    if (near) return;
    if (!lazy) {
      setNear(true);
      return;
    }
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR_SCREEN_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [lazy, near, ref]);
  return near;
}
