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

const STAGE_COLOR = {
  violet: "var(--pandora-violet)",
  sky: "var(--pandora-sky)",
  rose: "var(--pandora-rose)",
  gold: "var(--pandora-gold)",
} as const;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * "Let's see the Timeline". On a wide screen with motion allowed the scene pins and scrolling slides the track
 * sideways. Which milestone is lit is decided by where each card actually is on screen (a ScrollTrigger per card
 * that follows the sideways movement), so a card lights exactly as it arrives. On phones, narrow windows and with
 * reduced motion it is a vertical timeline down the page, and each stop lights as you reach it.
 */
export function Timeline() {
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const section = root.current;
      const trackEl = track.current;
      const viewportEl = viewport.current;
      const fillEl = fill.current;
      if (!section || !trackEl || !viewportEl || !fillEl) return;

      const items = gsap.utils.toArray<HTMLElement>("[data-milestone]", trackEl);

      // Lights milestone `active` and everything before it as done; moves the colour and the counter with it.
      const setActive = (active: number, horizontal: boolean) => {
        items.forEach((item, index) => {
          item.dataset.state = index < active ? "done" : index === active ? "active" : "idle";
        });
        const color = TIMELINE[active]?.color ?? "violet";
        section.style.setProperty("--stage", STAGE_COLOR[color]);
        if (counter.current) counter.current.textContent = pad(active + 1);
        const node = items[active]?.querySelector<HTMLElement>("[data-node]");
        if (!node) return;
        const nodeBox = node.getBoundingClientRect();
        const trackBox = trackEl.getBoundingClientRect();
        const length = horizontal ? fillEl.offsetWidth : fillEl.offsetHeight;
        const position = horizontal
          ? nodeBox.left + nodeBox.width / 2 - fillEl.getBoundingClientRect().left
          : nodeBox.top + nodeBox.height / 2 - trackBox.top;
        gsap.to(fillEl, {
          [horizontal ? "scaleX" : "scaleY"]: Math.min(1, Math.max(0, position / length)),
          duration: 0.7,
          ease: "power2.out",
          overwrite: "auto",
        });
      };

      const mm = gsap.matchMedia();

      // Wide screen, motion allowed: pinned, sideways.
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const distance = () => Math.max(0, trackEl.scrollWidth - viewportEl.clientWidth);
        gsap.set(items, { clearProps: "opacity" });
        setActive(0, true);

        const slide = gsap.to(trackEl, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${distance() + window.innerHeight * 0.35}`,
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        const triggers = items.map((item, index) =>
          ScrollTrigger.create({
            trigger: item,
            containerAnimation: slide,
            start: "left 66%",
            end: "left 20%",
            onEnter: () => setActive(index, true),
            onEnterBack: () => setActive(index, true),
            onLeaveBack: () => setActive(Math.max(0, index - 1), true),
          }),
        );

        return () => {
          triggers.forEach((trigger) => trigger.kill());
          gsap.set([trackEl, fillEl], { clearProps: "transform" });
        };
      });

      // Phones, narrow windows and reduced motion: vertical.
      mm.add("(max-width: 899px), (prefers-reduced-motion: reduce)", () => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reducedMotion) {
          // Everything stays fully visible; just show the whole line filled and no stop highlighted.
          items.forEach((item) => (item.dataset.state = "done"));
          gsap.set(fillEl, { scaleY: 1 });
          if (counter.current) counter.current.textContent = pad(items.length);
          return;
        }

        setActive(0, false);
        const triggers = items.map((item, index) =>
          ScrollTrigger.create({
            trigger: item,
            start: "top 62%",
            end: "bottom 38%",
            onEnter: () => setActive(index, false),
            onEnterBack: () => setActive(index, false),
          }),
        );
        gsap.from(items, {
          opacity: 0,
          x: -24,
          duration: 0.7,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: trackEl, start: "top 80%", once: true },
        });
        return () => triggers.forEach((trigger) => trigger.kill());
      });

      ScrollTrigger.refresh();
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section id="timeline" ref={root} className={`${styles.scene} ${styles.timeline}`} aria-labelledby="timeline-title">
      <div className={styles.timelineGhost} aria-hidden="true">
        {pad(TIMELINE.length)}
      </div>
      <div className={styles.timelineInner}>
        <div className={styles.timelineHead}>
          <h2 id="timeline-title" className={styles.timelineTitle}>
            Let&rsquo;s see the Timeline
          </h2>
          <p className={styles.timelineCount} aria-hidden="true">
            <span ref={counter} className={styles.timelineCountNow}>
              01
            </span>{" "}
            / {pad(TIMELINE.length)}
          </p>
        </div>
        <div ref={viewport} className={styles.timelineViewport}>
          <div ref={track} className={styles.timelineTrack}>
            <div className={styles.timelineLine} aria-hidden="true" />
            <div ref={fill} className={styles.timelineFill} aria-hidden="true" />
            <ol className={styles.timelineList}>
            {TIMELINE.map((milestone, index) => (
              <li
                key={milestone.title}
                data-milestone
                data-state="idle"
                className={`${styles.milestone} ${COLOR_CLASS[milestone.color]} ${
                  index % 2 === 0 ? styles.milestoneAbove : styles.milestoneBelow
                }`}
              >
                <div className={styles.milestoneCard}>
                  <span className={styles.milestoneIndex} aria-hidden="true">
                    {pad(index + 1)}
                  </span>
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
      </div>
    </section>
  );
}
