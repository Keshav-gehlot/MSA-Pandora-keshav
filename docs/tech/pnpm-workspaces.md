# pnpm workspaces

**What it is.** pnpm is a package manager like npm. Workspaces let one repository hold several packages that depend
on each other (`"@pandora/core": "workspace:*"`), installed together with a single lockfile.

**Why here.** Two apps and five packages share code. pnpm is also strict: a package can only import what its own
`package.json` lists, which is what makes our boundary rules enforceable.

**Instead of.** npm or yarn workspaces. They work, but they hoist dependencies so code can accidentally import
packages it never declared.

**In this repo.** `pnpm-workspace.yaml` lists `apps/*` and `packages/*`. Run one workspace's script with
`pnpm --filter @pandora/web <script>`.

**Read next.** https://pnpm.io/workspaces
