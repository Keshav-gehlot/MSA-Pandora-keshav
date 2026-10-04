"use client";

import { gsap, useGSAP, usePrefersReducedMotion } from "@pandora/ui";

/** Parallax and entrance for the registration scene; renders nothing itself. */
export function RegisterMotion() {
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const section = document.querySelector<HTMLElement>("#register");
      if (reduced || !section) return;

      gsap.fromTo(
        "#register [data-art-image]",
        { yPercent: -8 },
        { yPercent: 8, ease: "none", scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true } },
      );
      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: section, start: "top 60%", once: true },
        })
        .from("#register [data-register-head]", { opacity: 0, y: 30, duration: 0.9 })
        .from("#register [data-register-card]", { opacity: 0, y: 80, scale: 0.97, duration: 1.1 }, "-=0.5");
    },
    { dependencies: [reduced] },
  );

  return null;
}
