"use client";

import { gsap, ScrollTrigger, useGSAP } from "@pandora/ui";
import { useRef } from "react";
import { TIMELINE } from "./content";
import styles from "./landing.module.css";

const COLOR_CLASS = {
  violet: styles.violet,
  sky: styles.sky,
  rose: styles.rose,
  gold: styles.gold,
} as const;

/**
 * "Let's see the Timeline": milestones along a line. On a wide screen with motion allowed the section pins and
 * scrolling the page slides the line sideways while each node lights up; otherwise (phones, reduced motion, no
 * scripts) it is an ordinary horizontally scrollable row that snaps to each milestone.
 */
export function Timeline() {
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const trackEl = track.current;
        const viewportEl = viewport.current;
        if (!trackEl || !viewportEl) return;
        const nodes = gsap.utils.toArray<HTMLElement>("[data-node]", trackEl);
        const cards = gsap.utils.toArray<HTMLElement>("[data-milestone]", trackEl);
        const distance = () => Math.max(0, trackEl.scrollWidth - viewportEl.clientWidth);
        const section = root.current;
        section?.setAttribute("data-pinned", "true");

        // Milestones start dimmed and light up as the line reaches them.
        gsap.set(cards, { opacity: 0.35 });
        gsap.set(nodes, { scale: 0.7 });

        const slide = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
        slide.to(trackEl, { x: () => -distance() }, 0);

        cards.forEach((card, index) => {
          const node = nodes[index];
          // Each milestone lights up when its left edge has travelled into the right 80% of the viewport.
          const at = (index / Math.max(1, cards.length - 1)) * 0.85;
          slide.to(card, { opacity: 1, duration: 0.08, ease: "power1.out" }, at);
          if (node) slide.to(node, { scale: 1.15, duration: 0.08, ease: "back.out(2)" }, at);
        });

        return () => {
          section?.removeAttribute("data-pinned");
          gsap.set([trackEl, ...cards, ...nodes], { clearProps: "all" });
        };
      });
      ScrollTrigger.refresh();
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="timeline" ref={root} className={styles.timeline} aria-labelledby="timeline-title">
      <div className={styles.timelineInner}>
        <h2 id="timeline-title" className={styles.timelineTitle}>
          Let&rsquo;s see the Timeline
        </h2>
        <div ref={viewport} className={styles.timelineViewport} role="region" aria-label="Timeline" tabIndex={0}>
          <ol ref={track} className={styles.timelineTrack}>
            {TIMELINE.map((milestone, index) => (
              <li
                key={milestone.title}
                className={`${styles.milestone} ${COLOR_CLASS[milestone.color]} ${
                  index % 2 === 0 ? styles.milestoneAbove : styles.milestoneBelow
                }`}
              >
                <div className={styles.milestoneCard} data-milestone>
                  <p className={styles.milestoneDate}>{milestone.date}</p>
                  <h3 className={styles.milestoneTitle}>{milestone.title}</h3>
                  <p className={styles.milestoneText}>{milestone.text}</p>
                </div>
                <span className={styles.milestoneNode} data-node aria-hidden="true" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
