"use client";

import { gsap, OrnamentFrame, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef, useState } from "react";
import { TRACK_INFO } from "./content";
import styles from "./landing.module.css";

/**
 * "One of 4 Tracks": four cards on one baseline (Track B stands taller) and a panel under them that shows the
 * chosen track's brief. The painting drifts behind, the cards fly in and tilt toward the pointer, and the chosen
 * card lifts. Nothing is positioned over the panel, so the cards can never overlap it.
 */
export function Tracks() {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const reduced = usePrefersReducedMotion();
  const current = TRACK_INFO[selected] ?? TRACK_INFO[0]!;

  useGSAP(
    () => {
      if (reduced || !root.current) return;
      const cards = gsap.utils.toArray<HTMLElement>("[data-track-card]");

      gsap.fromTo(
        "[data-art-image]",
        { yPercent: -7 },
        {
          yPercent: 7,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
        },
      );

      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: root.current, start: "top 55%", once: true },
        })
        .from("[data-tracks-heading]", { opacity: 0, y: 30, duration: 0.9 })
        .fromTo(
          cards,
          { opacity: 0, y: 120, scale: 0.9, rotateZ: (index: number) => (index % 2 ? 5 : -5) },
          { opacity: 1, y: 0, scale: 1, rotateZ: 0, duration: 1.2, stagger: 0.14 },
          "-=0.5",
        )
        .from("[data-track-panel]", { opacity: 0, y: 40, duration: 0.9 }, "-=0.6");

      // Tilt toward the pointer, for a fine pointer only. The tilt is on an inner layer of each card, so it can
      // never fight the card's own entrance and lift animations.
      if (window.matchMedia("(pointer: fine)").matches) {
        const cleanups = cards.map((card) => {
          const tilt = card.querySelector<HTMLElement>("[data-tilt]");
          if (!tilt) return () => {};
          const rx = gsap.quickTo(tilt, "rotateX", { duration: 0.5, ease: "power3" });
          const ry = gsap.quickTo(tilt, "rotateY", { duration: 0.5, ease: "power3" });
          const onMove = (event: PointerEvent) => {
            const box = card.getBoundingClientRect();
            const px = (event.clientX - box.left) / box.width - 0.5;
            const py = (event.clientY - box.top) / box.height - 0.5;
            ry(px * 12);
            rx(py * -12);
          };
          const onLeave = () => {
            rx(0);
            ry(0);
          };
          card.addEventListener("pointermove", onMove);
          card.addEventListener("pointerleave", onLeave);
          return () => {
            card.removeEventListener("pointermove", onMove);
            card.removeEventListener("pointerleave", onLeave);
          };
        });
        return () => cleanups.forEach((fn) => fn());
      }
    },
    { scope: root, dependencies: [reduced] },
  );

  function select(index: number) {
    if (index === selected) return;
    setSelected(index);
    if (reduced) return;
    const cards = gsap.utils.toArray<HTMLElement>("[data-track-card]", root.current);
    cards.forEach((card, cardIndex) => {
      gsap.to(card, { y: cardIndex === index ? -12 : 0, scale: cardIndex === index ? 1.03 : 1, duration: 0.5, ease: "power3.out" });
    });
    if (panel.current) {
      gsap.fromTo(panel.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    }
  }

  return (
    <section ref={root} className={`${styles.scene} ${styles.tracks}`} aria-labelledby="tracks-title">
      <div className={`${styles.art} ${styles.tracksArt}`} data-art-image aria-hidden="true" />
      <div className={styles.tracksInner}>
        <h2 id="tracks-title" className={styles.tracksHeading} data-tracks-heading>
          <span className={styles.tracksLead}>Find the</span> <span className={styles.tracksBig}>One of 4 Tracks</span>{" "}
          <span className={styles.tracksLead}>that fit your vibe :)</span>
        </h2>

        <div className={styles.trackCards} role="group" aria-label="Tracks" style={{ perspective: 1200 }}>
          {TRACK_INFO.map((track, index) => (
            <button
              key={track.id}
              type="button"
              data-track-card
              aria-pressed={index === selected}
              onClick={() => select(index)}
              className={`${styles.trackCard} ${index === 1 ? styles.trackCardRaised : ""} ${
                index === selected ? styles.trackCardSelected : ""
              }`}
            >
              <span data-tilt className={styles.trackTilt}>
                <OrnamentFrame as="span" cornerSize={50} bordered style={{ display: "block", flex: 1, background: "var(--pandora-paper)" }}>
                  <span className={styles.trackCardBody}>
                    <span className={styles.trackId}>{track.id}</span>
                    <span className={styles.trackName}>{track.name}</span>
                    <span className={styles.trackSummary}>{track.summary}</span>
                  </span>
                </OrnamentFrame>
              </span>
            </button>
          ))}
        </div>

        <div ref={panel} className={styles.trackPanel} data-track-panel aria-live="polite">
          <div className={styles.trackPanelCell}>
            <h3 className={styles.trackPanelTitle}>{current.name}</h3>
            <p className={styles.trackPanelText}>{current.summary}</p>
          </div>
          <div className={styles.trackPanelCell}>
            <h3 className={styles.trackPanelTitle}>Statement</h3>
            <p className={styles.trackPanelText}>{current.statement}</p>
          </div>
          <div className={styles.trackPanelCell}>
            <h3 className={styles.trackPanelTitle}>Expected Solution</h3>
            <p className={styles.trackPanelText}>{current.expectedSolution}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
