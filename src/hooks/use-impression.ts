import { useEffect, useRef } from "react";

/**
 * Calls `onImpression` once when the element is 100% visible for at least 1 second.
 * Server-side dedupe (session/IP per hour) is the anti-fraud authority.
 */
export function useImpression<T extends Element>(onImpression: (() => void) | null, key?: string) {
  const ref = useRef<T | null>(null);
  const fired = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onImpression || fired.current === (key ?? "1")) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e && e.intersectionRatio >= 0.99) {
          if (!timer)
            timer = setTimeout(() => {
              fired.current = key ?? "1";
              onImpression();
              obs.disconnect();
            }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5, 0.99, 1] },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!onImpression]);
  return ref;
}
