# Astryx

**What it is.** The component library (`@astryxdesign/core`, MIT, from Meta) behind Pandora's UI: accessible React
components (buttons, inputs, selectors, steppers, banners, layout stacks) with built-in spacing, dark mode and
StyleX styling, plus a theme system. Each component is imported from its own subpath, for example
`@astryxdesign/core/Button`, and ships as a client component.

**Why here.** msa-auth already uses it with the MSA theme, so MSA knows its API, and the form-heavy screens
(registration, the admin console) get accessible controls without us building and testing each one.

**Instead of.** Building our own components from scratch: slower, and accessibility (keyboard use, focus, labels) is
easy to get subtly wrong. A larger kit such as MUI or Chakra: heavier, and we would have to re-theme it to match the
MSA look that msa-auth already has in Astryx.

**In this repo.** Only `packages/ui` depends on `@astryxdesign/core`. It applies the MSA theme in `AppProviders`
(`src/providers.tsx`, `src/theme/msa.ts`) and re-exports the components the apps use from `src/index.ts`, so an app
writes `import { Button, TextInput } from "@pandora/ui"` and never adds its own Astryx dependency. Need a component
that isn't exported yet? Add one `export` line for it in `packages/ui/src/index.ts` (and its name to
`src/index.test.ts`) in a small `area:ui` pull request; don't re-export everything. To look up a component's props
and examples, run `npx @astryxdesign/cli component Button` (or `component --list`).

**Read next.** https://github.com/facebook/astryx
