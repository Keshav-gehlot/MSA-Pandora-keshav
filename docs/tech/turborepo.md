# Turborepo

**What it is.** A task runner for monorepos. `turbo run build` runs `build` in every workspace in dependency order,
in parallel where it can, and skips work whose inputs haven't changed.

**Why here.** With seven workspaces, running lint, typecheck, test and build by hand is slow and easy to get wrong.
Turborepo makes the root scripts (`pnpm lint`, `pnpm build`) one command each.

**Instead of.** Plain `pnpm -r run build`: it works, but has no caching and no task graph.

**In this repo.** `turbo.json` defines the tasks; the root `package.json` scripts call `turbo run <task>`.

**Read next.** https://turborepo.com/docs
