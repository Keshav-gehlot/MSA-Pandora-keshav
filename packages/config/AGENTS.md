# packages/config

Shared TypeScript presets (`tsconfig.*.json`) and ESLint flat configs (`eslint/`). Issues carry the `area:infra` label.

- A change here affects every workspace. Run `pnpm lint && pnpm typecheck` at the repo root before opening the pull request.
- Don't turn rules off to make a failure go away; fix the code, or raise it in the issue.
