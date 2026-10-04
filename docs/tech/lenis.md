# Lenis

**What it is.** A small library (`lenis`, MIT) that replaces the browser's jumpy wheel scrolling with smooth, eased
scrolling, while keeping the page's real scroll position and native scrollbar.

**Why here.** The landing page is a sequence of full-screen scenes with pinned and scrubbed animation. Eased scrolling
is what makes that feel cinematic instead of stepped, and it hands GSAP's ScrollTrigger a steady position to follow.

**Instead of.** GSAP's ScrollSmoother (needs a wrapper structure that fights `position: fixed` and pinning), or plain
CSS `scroll-behavior: smooth` (smooths only anchor jumps, not wheel scrolling).

**In this repo.** Only `packages/ui` depends on it. `<SmoothScroll />` (`src/motion/smooth-scroll.tsx`, exported from
`@pandora/ui`) starts it, connects it to GSAP's ticker and ScrollTrigger, and makes in-page `#links` glide to their
section. It does nothing under `prefers-reduced-motion`, and on touch devices the browser's own scrolling is kept.
Render it once, on the landing page only; screens that don't render it are unaffected.

**Read next.** https://github.com/darkroomengineering/lenis
