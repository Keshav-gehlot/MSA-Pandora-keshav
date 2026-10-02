"use client";

import { CornerOrnament, gsap, useGSAP, usePrefersReducedMotion } from "@pandora/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { ABOUT_SLIDES } from "./content";
import styles from "./landing.module.css";

/** "About us and our Past Events": a three-card carousel on a native snapping scroller, driven by two buttons. */
export function About() {
  const root = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const reduced = usePrefersReducedMotion();
  const last = ABOUT_SLIDES.length - 1;
  const onAbout = ABOUT_SLIDES[index]?.kind === "about";

  // Track which slide is showing as the visitor swipes or scrolls the scroller by hand.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setIndex(Math.min(last, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [last]);

  const goTo = useCallback(
    (next: number) => {
      const el = scroller.current;
      if (!el) return;
      const target = Math.min(last, Math.max(0, next));
      el.scrollTo({ left: target * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
    },
    [last, reduced],
  );

  useGSAP(
    () => {
      if (reduced) return;
      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: root.current, start: "top 65%", once: true },
        })
        .from("[data-about-head]", { opacity: 0, y: 24, duration: 0.8 })
        .from("[data-about-scroller]", { opacity: 0, y: 40, duration: 0.9 }, "-=0.5");
    },
    { scope: root, dependencies: [reduced] },
  );

  // A slide's photo settles in each time it becomes the current one.
  useGSAP(
    () => {
      if (reduced) return;
      gsap.fromTo(
        `[data-slide="${index}"] [data-slide-photo]`,
        { scale: 1.08 },
        { scale: 1, duration: 1.1, ease: "power2.out", overwrite: "auto" },
      );
    },
    { scope: root, dependencies: [index, reduced] },
  );

  return (
    <section id="about" ref={root} className={styles.about} aria-labelledby="about-title">
      <div className={styles.aboutBg} aria-hidden="true" />
      <div className={styles.aboutInner}>
        <div className={styles.aboutHead} data-about-head>
          <div>
            <p className={styles.aboutKicker}>by the way, some stuff...</p>
            <h2 id="about-title" className={styles.aboutTitle}>
              <span className={onAbout ? styles.aboutActive : styles.aboutIdle}>About us</span>{" "}
              <span className={onAbout ? styles.aboutIdle : styles.aboutActive}>and our Past Events</span>
            </h2>
          </div>
          <div className={styles.aboutControls}>
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous slide">
              &lt;
            </button>
            <button type="button" onClick={() => goTo(index + 1)} disabled={index === last} aria-label="Next slide">
              &gt;
            </button>
          </div>
        </div>

        <div
          ref={scroller}
          className={styles.aboutScroller}
          data-about-scroller
          role="region"
          aria-roledescription="carousel"
          aria-label="About us and past events"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") goTo(index + 1);
            if (event.key === "ArrowLeft") goTo(index - 1);
          }}
        >
          {ABOUT_SLIDES.map((slide, slideIndex) => (
            <article
              key={slide.title}
              data-slide={slideIndex}
              className={styles.aboutSlide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIndex + 1} of ${ABOUT_SLIDES.length}: ${slide.title}`}
            >
              <div className={styles.aboutCard}>
                <div className={styles.aboutPhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.photo} alt={slide.photoAlt} data-slide-photo className={styles.aboutPhotoImage} />
                  <div className={styles.aboutPhotoCorners} aria-hidden="true">
                    <CornerOrnament corner="top-left" size={44} />
                    <CornerOrnament corner="top-right" size={44} />
                    <CornerOrnament corner="bottom-left" size={44} />
                    <CornerOrnament corner="bottom-right" size={44} />
                  </div>
                </div>
                <div className={styles.aboutText}>
                  <h3 className={styles.aboutSlideTitle}>{slide.title}</h3>
                  <p>{slide.text}</p>
                </div>
                <p className={styles.aboutSignature} aria-hidden="true">
                  Microsoft Student Ambassadors
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
