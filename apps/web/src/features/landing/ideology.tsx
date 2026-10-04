"use client";

import { DiamondRule, gsap, SplitText, useGSAP, usePrefersReducedMotion, ZigzagDivider } from "@pandora/ui";
import { useRef } from "react";
import styles from "./landing.module.css";

// Placeholder copy from the Figma file; the organisers replace it with the real ideology text.
const PARAGRAPHS = [
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque eum fugiat quo voluptas nulla pariatur?",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem.",
];

/**
 * "The Ideology": the heading draws in between two zigzag rules, and the paragraphs light up word by word as you
 * scroll through them, so the text is read at the pace of the scroll.
 */
export function Ideology() {
  const root = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced || !root.current || !card.current) return;

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
          scrollTrigger: { trigger: card.current, start: "top 78%", once: true },
        })
        .fromTo("[data-card]", { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 })
        .from("[data-zig]", { scaleX: 0, duration: 0.9 }, "-=0.5")
        .from("[data-ideology-title]", { opacity: 0, y: 14, duration: 0.7 }, "-=0.7");

      const split = SplitText.create(root.current.querySelectorAll("[data-ideology-body]"), { type: "words" });
      gsap.set(split.words, { opacity: 0.14 });
      gsap.to(split.words, {
        opacity: 1,
        ease: "none",
        stagger: 0.1,
        scrollTrigger: { trigger: card.current, start: "top 62%", end: "bottom 62%", scrub: 0.6 },
      });
      gsap.from("[data-ideology-rule]", {
        opacity: 0,
        scale: 0.7,
        duration: 0.9,
        ease: "back.out(2)",
        scrollTrigger: { trigger: "[data-ideology-rule]", start: "top 92%", once: true },
      });
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <section ref={root} className={`${styles.scene} ${styles.ideology}`} aria-labelledby="ideology-title">
      <div className={`${styles.art} ${styles.ideologyArt}`} data-art-image aria-hidden="true" />
      <div ref={card} className={styles.ideologyCard} data-card>
        <div className={styles.ideologyHead}>
          <div data-zig className={styles.zig}>
            <ZigzagDivider />
          </div>
          <h2 id="ideology-title" className={styles.ideologyTitle} data-ideology-title>
            The Ideology
          </h2>
          <div data-zig className={styles.zig}>
            <ZigzagDivider />
          </div>
        </div>
        {PARAGRAPHS.map((text) => (
          <p key={text.slice(-24)} className={styles.ideologyBody} data-ideology-body>
            {text}
          </p>
        ))}
        <div className={styles.ideologyRule} data-ideology-rule>
          <DiamondRule />
        </div>
      </div>
    </section>
  );
}
