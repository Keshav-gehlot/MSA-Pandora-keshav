"use client";

import { DiamondRule, gsap, useGSAP, usePrefersReducedMotion, ZigzagDivider } from "@pandora/ui";
import { useRef } from "react";
import styles from "./landing.module.css";

// Placeholder copy from the Figma file; the organisers replace it with the real ideology text.
const PARAGRAPHS = [
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque eum fugiat quo voluptas nulla pariatur?",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem.",
];

/** "The Ideology": heading between two zigzag rules, the text, and a diamond rule. */
export function Ideology() {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const trigger = { trigger: root.current, start: "top 75%", once: true };
      gsap
        .timeline({ scrollTrigger: trigger, defaults: { ease: "power3.out" } })
        .from("[data-zig]", { scaleX: 0, duration: 0.8, stagger: 0 })
        .from("[data-ideology-title]", { opacity: 0, y: 16, duration: 0.7 }, "-=0.6")
        .from("[data-ideology-body]", { opacity: 0, y: 24, duration: 0.8, stagger: 0.15 }, "-=0.4")
        .from("[data-ideology-rule]", { opacity: 0, duration: 0.6 }, "-=0.3");
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <div ref={root} className={styles.column} style={{ position: "relative" }}>
      <div className={styles.ideology}>
        <div className={styles.ideologyHead}>
          <div data-zig className={styles.zig}>
            <ZigzagDivider />
          </div>
          <h2 className={styles.ideologyTitle} data-ideology-title>
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
    </div>
  );
}
