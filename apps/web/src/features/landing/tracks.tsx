"use client";

import { gsap, OrnamentFrame, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef, useState } from "react";
import { TRACK_INFO } from "./content";
import styles from "./landing.module.css";

/** "One of 4 Tracks": four cards (Track B stands raised) and a panel showing the chosen track's brief. */
export function Tracks() {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const reduced = usePrefersReducedMotion();
  const current = TRACK_INFO[selected] ?? TRACK_INFO[0]!;

  useGSAP(
    () => {
      if (reduced) return;
      gsap.from("[data-track-card]", {
        opacity: 0,
        y: 48,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: root.current, start: "top 55%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  function select(index: number) {
    if (index === selected) return;
    setSelected(index);
    if (!reduced && panel.current) {
      gsap.fromTo(panel.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" });
    }
  }

  return (
    <section ref={root} className={styles.tracks} aria-labelledby="tracks-title">
      <div className={styles.tracksBg} aria-hidden="true" />
      <div className={styles.tracksInner}>
        <h2 id="tracks-title" className={styles.tracksHeading}>
          <span className={styles.tracksLead}>Find the</span> <span className={styles.tracksBig}>One of 4 Tracks</span>{" "}
          <span className={styles.tracksLead}>that fit your vibe :)</span>
        </h2>

        <div className={styles.trackCards} role="group" aria-label="Tracks">
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
              <OrnamentFrame as="span" cornerSize={50} bordered style={{ display: "block", flex: 1, background: "var(--pandora-paper)" }}>
                <span className={styles.trackCardBody}>
                  <span className={styles.trackId}>{track.id}</span>
                  <span className={styles.trackName}>{track.name}</span>
                  <span className={styles.trackSummary}>{track.summary}</span>
                </span>
              </OrnamentFrame>
            </button>
          ))}
        </div>

        <div ref={panel} className={styles.trackPanel} aria-live="polite">
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
