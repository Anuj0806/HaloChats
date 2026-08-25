import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query.
 *
 * useSyncExternalStore is the right tool here rather than
 * useState + useEffect: matchMedia *is* an external store, and this
 * form reads the current value during render, so the very first
 * paint already matches the viewport. The effect-based version
 * renders the mobile layout for one frame on desktop and visibly
 * snaps, and trips React's set-state-in-effect warning besides.
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};

      const list = window.matchMedia(query);

      // addListener is the deprecated form, still needed by older Safari.
      if (list.addEventListener) {
        list.addEventListener("change", onChange);
        return () => list.removeEventListener("change", onChange);
      }

      list.addListener(onChange);
      return () => list.removeListener(onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
