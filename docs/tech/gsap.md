# GSAP

**What it is.** GSAP (GreenSock Animation Platform, `gsap` plus `@gsap/react`) is a JavaScript animation library. We use
its core timeline engine and the ScrollTrigger plugin to tie animation to scrolling: reveals, the pinned sideways
timeline, parallax. As of 2025 GSAP and all its plugins are free to use, including commercially.

**Why here.** The public landing page needs scroll-driven motion (a pinned horizontal timeline, staged reveals) that
CSS alone can't do reliably. GSAP handles that and cleans up after itself through the `useGSAP` hook.

**Instead of.** CSS animations and `IntersectionObserver` (no scrubbing or pinning), or Framer Motion (good for
component transitions, weak for long scroll choreography).

**In this repo.** Only `packages/ui` depends on it. Import `gsap`, `ScrollTrigger` and `useGSAP` from
`@pandora/ui`, never from `gsap` directly: `packages/ui/src/motion/gsap.ts` registers the plugins once.
Animate only inside client components, and always honour `usePrefersReducedMotion()`: with reduced motion the
content must simply be there, unhidden. `<Reveal>` is the ready-made fade-and-lift for a block.

**Read next.** https://gsap.com/docs/v3/ and https://gsap.com/resources/React/
