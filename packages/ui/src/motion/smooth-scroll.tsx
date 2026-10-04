"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, ScrollTrigger } from "./gsap";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

let current: Lenis | null = null;

/** Scrolls to an element or a pixel offset through the smooth scroller, or jumps when there isn't one. */
export function scrollToTarget(target: string | HTMLElement | number, offset = 0): void {
  if (current) {
    current.scrollTo(target, { offset, duration: 1.4 });
    return;
  }
  if (typeof target === "number") {
    window.scrollTo({ top: target + offset });
    return;
  }
  const element = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (element) {
    window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY + offset });
  }
}

/**
 * Smooth, eased page scrolling (Lenis) wired into GSAP's ScrollTrigger, so pinned scenes and scrubbed animations
 * follow the eased position. It does nothing under reduced motion, and on touch devices the browser's own scrolling
 * is kept. Render it once near the top of the page.
 */
export function SmoothScroll() {
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, autoRaf: false });
    current = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    // In-page links glide to their section instead of jumping.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      const hash = link?.getAttribute("href");
      if (!link || !hash || hash.length < 2 || !document.querySelector(hash)) return;
      event.preventDefault();
      lenis.scrollTo(hash, { duration: 1.4 });
      window.history.replaceState(null, "", hash);
    };
    document.addEventListener("click", onClick);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
      if (current === lenis) current = null;
    };
  }, [reduced]);

  return null;
}
