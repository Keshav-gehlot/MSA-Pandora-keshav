"use client";

import { gsap, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useRef } from "react";
import { FACTS } from "./content";
import styles from "./landing.module.css";

const formatter = new Intl.NumberFormat("en-IN");

/**
 * "A Challenge worth entering": a huge outlined word drifts sideways behind the pitch as you scroll, the painting
 * moves slower than the page, the six facts rise in one after another (the money figures count up), and the
 * script line draws itself.
 */
export function Challenge() {
  const root = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !root.current) return;
      const scrub = { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } as const;

      gsap.fromTo("[data-art-image]", { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: scrub });
      gsap.fromTo("[data-marquee]", { xPercent: 6 }, { xPercent: -42, ease: "none", scrollTrigger: scrub });

      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: root.current, start: "top 55%", once: true },
        })
        .from("[data-challenge-title]", { opacity: 0, x: -50, duration: 1 })
        .from("[data-challenge-sub]", { opacity: 0, x: -30, duration: 0.9 }, "-=0.7")
        .from("[data-challenge-statement]", { opacity: 0, y: 40, duration: 1 }, "-=0.8")
        .from("[data-fact]", { opacity: 0, y: 36, duration: 0.8, stagger: 0.1 }, "-=0.5");

      // The two money figures count up when their cell arrives.
      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
        const target = Number(el.dataset.count);
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = formatter.format(Math.round(counter.value));
          },
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        });
      });

      gsap.from("[data-script]", {
        opacity: 0,
        y: 30,
        duration: 1.1,
        ease: "power3.out",
        scrollTrigger: { trigger: "[data-script]", start: "top 92%", once: true },
      });
      gsap.from("[data-script-line]", {
        scaleX: 0,
        transformOrigin: "left center",
        duration: 1.4,
        ease: "power2.inOut",
        scrollTrigger: { trigger: "[data-script]", start: "top 92%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section ref={root} className={`${styles.scene} ${styles.challenge}`} aria-labelledby="challenge-title">
      <div className={`${styles.art} ${styles.challengeArt}`} data-art-image aria-hidden="true" />
      <div className={styles.marquee} data-marquee aria-hidden="true">
        <span>CHALLENGE</span>
        <span>CHALLENGE</span>
        <span>CHALLENGE</span>
      </div>

      <div className={styles.challengeInner}>
        <div className={styles.challengeTop}>
          <div>
            <h2 id="challenge-title" className={styles.challengeTitle} data-challenge-title>
              A Challenge
            </h2>
            <p className={styles.challengeSub} data-challenge-sub>
              worth entering
            </p>
          </div>
          <p className={styles.statement} data-challenge-statement>
            Pandora is a space for <br className={styles.statementBreak} />
            ideas that <span className={styles.statementAccent}>refuse to stay ordinary</span>
          </p>
        </div>
      </div>

      <dl className={styles.facts}>
        {FACTS.map((fact) => {
          const numeric = fact.currency ? Number(fact.value.replace(/,/g, "")) : null;
          return (
            <div key={fact.label} className={styles.fact} data-fact>
              <dt className={styles.factLabel}>{fact.label}</dt>
              <dd className={styles.factValue}>
                {fact.currency ? <sup className={styles.factCurrency}>{fact.currency}</sup> : null}
                {numeric !== null && Number.isFinite(numeric) ? (
                  <span data-count={numeric}>{fact.value}</span>
                ) : (
                  fact.value
                )}
              </dd>
              {fact.note ? <dd className={styles.factNote}>{fact.note}</dd> : null}
            </div>
          );
        })}
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
