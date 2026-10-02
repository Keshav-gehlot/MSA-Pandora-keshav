"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { gsap, useGSAP } from "./gsap";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type RevealProps = {
  children: ReactNode;
  /** Seconds to wait before the animation starts. */
  delay?: number;
  /** How far the content rises while it fades in, in pixels. */
  distance?: number;
  style?: CSSProperties;
};

/**
 * Fades its content in and lifts it slightly the first time it scrolls into view. With reduced motion, or before
 * scripts run, the content is simply there: nothing is hidden by default.
 */
export function Reveal({ children, delay = 0, distance = 24, style }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !ref.current) return;
      gsap.from(ref.current, {
        opacity: 0,
        y: distance,
        duration: 0.8,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top bottom-=40", once: true },
      });
    },
    { scope: ref, dependencies: [reduced, delay, distance] },
  );

  return (
    <div ref={ref} style={style}>
      {children}
    </div>
  );
}
