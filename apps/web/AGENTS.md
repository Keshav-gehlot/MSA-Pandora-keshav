# apps/web

The public site at pandora.msasrm.in: landing page, registration, participant sign-in, team dashboard,
event-day participant screens and the Wrapped pages. Issues for this app carry the `area:web` label.

- Put business rules (validation, eligibility, scoring) in `@pandora/core`, not in components or route handlers.
- Read and write data only through functions exported by `@pandora/db`.
- Reuse components from `@pandora/ui`; if a component would be useful in the console too, it belongs there.
- Everything must work on phones first. Check every screen at 375px wide.
- Never import from `apps/console`.
