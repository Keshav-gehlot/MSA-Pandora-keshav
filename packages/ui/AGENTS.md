# packages/ui

The Pandora design system: tokens, components and motion primitives shared by both apps. Issues carry the
`area:ui` label.

- Components are presentational: they take props and render. No data fetching, no `@pandora/db`.
- Every component works at 375px wide and is keyboard accessible.
- Export everything public through `src/index.ts`.

## Astryx components

The apps get Astryx components (`Button`, `TextInput`, `Selector`, `FileInput`, `Stepper`, `Banner`, `Field`, and so
on) from `@pandora/ui`, never from `@astryxdesign/core` directly, so there is one Astryx version and one theme. If an
app needs a component that isn't exported yet, add one `export` line for it to `src/index.ts` (and its name to
`src/index.test.ts`) in a small `area:ui` pull request. See `docs/tech/astryx.md`.
