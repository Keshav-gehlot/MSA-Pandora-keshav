# packages/ui

The Pandora design system: tokens, components and motion primitives shared by both apps. Issues carry the
`area:ui` label.

- Components are presentational: they take props and render. No data fetching, no `@pandora/db`.
- Every component works at 375px wide and is keyboard accessible.
- Export everything public through `src/index.ts`.
