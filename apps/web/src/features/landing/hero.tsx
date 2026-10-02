"use client";

import { CornerOrnament, gsap, ScrollTrigger, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef } from "react";
import styles from "./landing.module.css";

/** The landscape, the four panes and the "Pandora" title, with a slow parallax and a staged entrance. */
export function Hero() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const panes = gsap.utils.toArray<HTMLElement>(`.${styles.pane}`);
      const corners = gsap.utils.toArray<SVGElement>("[data-hero-corner]");

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        // fromTo with explicit ends: the CSS hides these before scripts load (html.motion), so "from" would read
        // the hidden state as the destination.
        .fromTo(
          panes,
          { clipPath: "inset(100% 0% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, stagger: 0.12 },
        )
        .fromTo("[data-hero-title]", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.9 }, "-=0.5")
        .fromTo(corners, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.6, stagger: 0.08 }, "-=0.7");

      gsap.to(`.${styles.heroArtImage}`, {
        yPercent: 8,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      ScrollTrigger.refresh();
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="overview" ref={root} className={styles.hero} aria-label="Overview">
      <div className={styles.heroArt} aria-hidden="true">
        <div className={styles.heroArtImage} />
      </div>
      <div className={styles.column}>
        <div className={styles.panes} aria-hidden="true">
          <div className={styles.pane} />
          <div className={styles.pane} />
          <div className={styles.pane} />
          <div className={styles.pane} />
        </div>
        <div className={styles.titleBox}>
          <div data-hero-corner className={styles.corners}>
            <CornerOrnament corner="top-left" size={100} />
            <CornerOrnament corner="top-right" size={100} />
            <CornerOrnament corner="bottom-left" size={100} />
            <CornerOrnament corner="bottom-right" size={100} />
          </div>
          <h1 style={{ margin: 0 }} data-hero-title>
            {/* The lettering from the Figma file already includes the "Microsoft Student Ambassadors SRM" line. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/pandora-title.svg" alt="Microsoft Student Ambassadors SRM: Pandora" className={styles.title} width={503} height={140} />
          </h1>
        </div>
      </div>
    </section>
  );
}
