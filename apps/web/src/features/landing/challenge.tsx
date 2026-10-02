"use client";

import { gsap, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef } from "react";
import { FACTS } from "./content";
import styles from "./landing.module.css";

/** "A Challenge worth entering": the pitch, the key facts grid, and the script line. */
export function Challenge() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      gsap.to(`.${styles.challengeArt}`, {
        yPercent: 10,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true },
      });
      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: root.current, start: "top 60%", once: true },
        })
        .from("[data-challenge-head]", { opacity: 0, x: -24, duration: 0.8 })
        .from("[data-challenge-statement]", { opacity: 0, y: 28, duration: 0.9 }, "-=0.5")
        .from("[data-fact]", { opacity: 0, y: 24, duration: 0.7, stagger: 0.08 }, "-=0.4");
      gsap.from("[data-script]", {
        opacity: 0,
        y: 24,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-script]", start: "top bottom-=60", once: true },
      });
      gsap.from("[data-script-line]", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.2,
        ease: "power2.inOut",
        scrollTrigger: { trigger: "[data-script]", start: "top bottom-=60", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section ref={root} className={styles.challenge} aria-labelledby="challenge-title">
      <div className={styles.challengeArt} aria-hidden="true" />
      <div className={styles.challengeInner}>
        <div className={styles.challengeTop}>
          <div data-challenge-head>
            <h2 id="challenge-title" className={styles.challengeTitle}>
              A Challenge
            </h2>
            <p className={styles.challengeSub}>worth entering</p>
          </div>
          <p className={styles.statement} data-challenge-statement>
            Pandora is a space for <br className={styles.statementBreak} />
            ideas that <span className={styles.statementAccent}>refuse to stay ordinary</span>
          </p>
        </div>
      </div>

      <dl className={styles.facts}>
        {FACTS.map((fact) => (
          <div key={fact.label} className={styles.fact} data-fact>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>
              {fact.currency ? <sup className={styles.factCurrency}>{fact.currency}</sup> : null}
              {fact.value}
            </dd>
            {fact.note ? <dd className={styles.factNote}>{fact.note}</dd> : null}
          </div>
        ))}
      </dl>

      <div className={styles.challengeInner}>
        <p className={styles.script} data-script>
          Show us what you&rsquo;re capable of
        </p>
        <div className={styles.scriptLine} data-script-line aria-hidden="true" />
      </div>
    </section>
  );
}
