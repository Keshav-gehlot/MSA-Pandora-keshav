"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** True when the visitor asked their system for less motion. Animate nothing, or only fade, when it is. */
export function usePrefersReducedMotion(): boolean {
  // On the server there is no preference to read; assume reduced so server HTML is the final, still layout.
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
