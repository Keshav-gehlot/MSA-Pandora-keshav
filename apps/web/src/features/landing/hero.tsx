"use client";

import { CornerOrnament, gsap, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef } from "react";
import styles from "./landing.module.css";

/**
 * The opening scene. The white strips between the four panes are fixed; a white curtain in each pane lifts away to
 * reveal the painting, the lettering is revealed from the baseline up, and the corner marks settle in. After that
 * the layers move at different speeds as you scroll (the painting slowest, the column faster) and, with a mouse,
 * they shift slightly toward the pointer for depth.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const q = gsap.utils.selector(root);

      gsap
        .timeline({ defaults: { ease: "expo.out" } })
        .fromTo("[data-art]", { scale: 1.35, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 2.4 }, 0)
        .to(q("[data-curtain]"), { scaleY: 0, duration: 1.3, stagger: 0.13, ease: "expo.inOut" }, 0.2)
        .fromTo(
          "[data-hero-title]",
          { opacity: 0, y: 46, scale: 0.94, clipPath: "inset(0 0 100% 0)", filter: "blur(10px)" },
          { opacity: 1, y: 0, scale: 1, clipPath: "inset(0 0 0% 0)", filter: "blur(0px)", duration: 1.5 },
          0.9,
        )
        .fromTo("[data-hero-corners]", { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 1.2 }, 1.3)
        .fromTo("[data-cue]", { opacity: 0 }, { opacity: 1, duration: 1 }, 2);

      // Scroll: each layer moves at its own speed.
      const scrub = { trigger: root.current, start: "top top", end: "bottom top", scrub: true } as const;
      gsap.to("[data-art-image]", { yPercent: 16, scale: 1.2, ease: "none", scrollTrigger: scrub });
      gsap.to("[data-column]", { yPercent: -14, ease: "none", scrollTrigger: scrub });
      gsap.to("[data-cue]", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "+=240", scrub: true },
      });

      // Pointer depth, only for a fine pointer (a mouse or trackpad).
      const el = root.current;
      if (el && window.matchMedia("(pointer: fine)").matches) {
        const art = gsap.quickTo("[data-art-image]", "x", { duration: 1.2, ease: "power3" });
        const artY = gsap.quickTo("[data-art-image]", "y", { duration: 1.2, ease: "power3" });
        const stage = gsap.quickTo("[data-stage]", "x", { duration: 0.9, ease: "power3" });
        const stageY = gsap.quickTo("[data-stage]", "y", { duration: 0.9, ease: "power3" });
        const onMove = (event: PointerEvent) => {
          const x = event.clientX / window.innerWidth - 0.5;
          const y = event.clientY / window.innerHeight - 0.5;
          art(x * -34);
          artY(y * -22);
          stage(x * 10);
          stageY(y * 6);
        };
        el.addEventListener("pointermove", onMove);
        return () => el.removeEventListener("pointermove", onMove);
      }
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section id="overview" ref={root} className={`${styles.scene} ${styles.hero}`} aria-label="Overview">
      <div className={styles.heroArt} aria-hidden="true">
        <div data-art style={{ position: "absolute", inset: 0 }}>
          <div data-art-image className={styles.heroArtImage} />
        </div>
      </div>
      <div className={styles.heroStage} data-stage>
        <div className={styles.column} data-column>
          <div className={styles.panes} aria-hidden="true">
            <span className={styles.strip} />
            {[0, 1, 2, 3].map((pane) => (
              <span key={pane} style={{ display: "contents" }}>
                <span className={styles.pane}>
                  <span className={styles.curtain} data-curtain />
                </span>
                <span className={styles.strip} />
              </span>
            ))}
          </div>
          <div className={styles.titleBox}>
            <div className={styles.corners} data-hero-corners>
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
      </div>
      <div className={styles.cue} data-cue aria-hidden="true">
        Scroll
        <span className={styles.cueLine} />
      </div>
    </section>
  );
}
