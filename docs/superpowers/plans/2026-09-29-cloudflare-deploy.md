# Cloudflare Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vercel-based deploy workflow (blocked by Hobby's non-owner-commit-author restriction) with
Cloudflare Workers, using the OpenNext adapter, so both apps deploy from GitHub Actions without that block.

**Architecture:** `apps/web` and `apps/console` each become one Cloudflare Worker via `@opennextjs/cloudflare`.
`packages/db`'s runtime client switches from the `pg` driver to `drizzle-orm/neon-serverless` (Workers-compatible,
keeps real `db.transaction()` support). CI keeps its existing `plan` → `migrate` → `deploy` shape, with Vercel CLI
steps replaced by `wrangler`, plus a new cleanup job that deletes a PR's Worker when the PR closes.

**Tech Stack:** `@opennextjs/cloudflare`, `wrangler`, `drizzle-orm/neon-serverless`, `@neondatabase/serverless`;
existing stack otherwise unchanged (Next.js 16, pnpm/Turborepo, GitHub Actions).

**Spec:** `docs/superpowers/specs/2026-09-29-cloudflare-deploy-design.md`

## Global Constraints

- Node >=22, pnpm 10.15.0 (root `package.json` "packageManager"), TypeScript ~5.9.3.
- Only `@pandora/db` may depend on `drizzle-orm`, `drizzle-kit`, `postgres`, `pg`, `@electric-sql/pglite`, or (new)
  `@neondatabase/serverless` — enforced by `scripts/check-boundaries.mjs`'s `DB_DRIVERS` list.
- `migrate.ts` and `seed.ts` keep using `pg` — do not touch their driver.
- No AI attribution in any commit message (repo-wide rule, enforced by a commit-msg hook).
- GitHub Environments `preview-web`, `preview-console`, `production-web`, `production-console` already hold the
  real secret values (moved from Vercel) — the workflow reads from these four, unchanged names.
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` already exist as repository secrets.
- Workers deploy under the account's `*.workers.dev` subdomain; no custom domain in this phase.

---

### Task 1: Switch `@pandora/db`'s runtime client to a Workers-compatible driver

**Files:**
- Modify: `packages/db/package.json`
- Modify: `packages/db/src/client.ts`
- Create: `packages/db/src/client.test.ts`
- Modify: `scripts/check-boundaries.mjs`
- Modify: `scripts/check-boundaries.test.mjs`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/console/next.config.ts`

**Interfaces:**
- Produces: `createDb(url: string): Db` and `getDb(): Db` — **same names and signatures as before** (only the
  internal driver changes). `Db` remains a `PgDatabase<..., typeof schema>` type usable by every query file in
  `packages/db/src/queries/*.ts` exactly as today, including `db.transaction(...)`.

- [ ] **Step 1: Add the new dependency**

In `packages/db/package.json`, add to `"dependencies"` (keep `pg` — `migrate.ts`/`seed.ts` still need it):

```json
    "@neondatabase/serverless": "^0.10.0",
```

Run:
```bash
pnpm install
```
Expected: lockfile updates, no errors.

- [ ] **Step 2: Write the failing test for `createDb`**

Create `packages/db/src/client.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createDb } from "./client";

describe("createDb", () => {
  it("returns a drizzle database without connecting", () => {
    // A syntactically valid but unreachable connection string. drizzle-orm/neon-serverless's Pool connects lazily
    // (on the first query), so constructing it here must not touch the network.
    const db = createDb("postgres://example.invalid/db");
    expect(typeof db.select).toBe("function");
    expect(typeof db.transaction).toBe("function");
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @pandora/db test -- client.test.ts`
Expected: FAIL — `client.ts` still exports the old `createDb`, so this specific test may actually pass already by
coincidence (the current driver also exposes `.select`/`.transaction`). If it passes already, that's fine — the
real check is Step 6 after the driver swap; continue to Step 4 regardless.

- [ ] **Step 4: Swap the driver in `client.ts`**

Replace the full contents of `packages/db/src/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/neon-serverless";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<NeonQueryResultHKT, typeof schema>;

export function createDb(url: string): Db {
  return drizzle({ connection: { connectionString: url, max: 5 }, schema, casing: "snake_case" });
}

let cached: Db | undefined;

// Lazily created so `next build` works without DATABASE_URL; the first query needs it.
export function getDb(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it to this app's .env.local (ask Ojas for the dev database URL).");
  }
  cached = createDb(url);
  return cached;
}
```

This is a Workers-compatible driver: `neon-serverless`'s `Pool` holds a real session over WebSocket (both
Cloudflare Workers and Node 22 have a native `WebSocket` global, so no `ws` polyfill is needed), which is why it
keeps supporting `db.transaction(...)` — unlike `drizzle-orm/neon-http`, which has no session and cannot run
transactions at all. `packages/db/src/queries/auth.ts`, `checkin.ts` and `registration.ts` all call
`db.transaction(...)`, so this distinction matters for correctness, not just style.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @pandora/db test -- client.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full `@pandora/db` test suite**

Run: `pnpm --filter @pandora/db test`
Expected: PASS — every other test in this package uses PGlite directly (`test-utils.ts`), not `client.ts`, so
nothing else should be affected.

- [ ] **Step 7: Allow the new dependency in the boundary check**

In `scripts/check-boundaries.mjs`, find:

```javascript
const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg", "@electric-sql/pglite"];
```

Change to:

```javascript
const DB_DRIVERS = ["drizzle-orm", "drizzle-kit", "postgres", "pg", "@electric-sql/pglite", "@neondatabase/serverless"];
```

- [ ] **Step 8: Add a boundary-check test for the new driver**

In `scripts/check-boundaries.test.mjs`, find the `clean` fixture array and its `@pandora/db` entry:

```javascript
  ws("@pandora/db", "package", ["drizzle-orm", "postgres", "drizzle-kit"]),
```

Change to:

```javascript
  ws("@pandora/db", "package", ["drizzle-orm", "postgres", "drizzle-kit", "@neondatabase/serverless"]),
```

Then find the test block that rejects a non-`@pandora/db` package using a DB driver (search for `"rejects a package using"` or similar wording already in the file) and add one case for the new driver alongside it — for example, if the existing test looks like:

```javascript
  it("rejects a package using a DB driver it doesn't own", () => {
    const v = findManifestViolations([...clean, ws("@pandora/z", "package", ["pg"])]);
    expect(v).toEqual(["@pandora/z depends on pg: only @pandora/db may use a database driver"]);
  });
```

add immediately after it:

```javascript
  it("rejects a package using @neondatabase/serverless directly", () => {
    const v = findManifestViolations([...clean, ws("@pandora/z", "package", ["@neondatabase/serverless"])]);
    expect(v).toEqual(["@pandora/z depends on @neondatabase/serverless: only @pandora/db may use a database driver"]);
  });
```

(Match the exact violation message string the existing test asserts — read it from the file first; the message
text above is illustrative and must match `check-boundaries.mjs`'s actual wording exactly, or the test will fail
for the wrong reason.)

- [ ] **Step 9: Run the boundary check tests**

Run: `pnpm --filter . exec vitest run scripts/check-boundaries.test.mjs` (or however the repo runs root-level
script tests — check `package.json`'s root `"test"` script; it runs `vitest run --dir scripts`, so
`pnpm test` from the repo root also works and is simplest)

Run: `pnpm test`
Expected: PASS

- [ ] **Step 10: Remove the now-unneeded `pg` external marker from both apps**

`pg` is no longer imported by the app runtime's dependency chain (only `packages/db/scripts/migrate.ts` and
`seed.ts` import it, and those never run inside a built app). Remove the line from `apps/web/next.config.ts`:

```typescript
  serverExternalPackages: ["pg"],
```

so it reads:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
```

Do the same in `apps/console/next.config.ts` (keep its `headers()` block unchanged):

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 11: Verify both apps still build**

Run: `pnpm --filter @pandora/web build`
Run: `pnpm --filter @pandora/console build`
Expected: both PASS. (This still builds for Node, not yet for Workers — Task 2/3 add that. This step only proves
removing `serverExternalPackages: ["pg"]` didn't break anything, i.e. nothing else in the app bundle still needs
`pg` marked external.)

- [ ] **Step 12: Commit**

```bash
git add packages/db/package.json packages/db/src/client.ts packages/db/src/client.test.ts \
  scripts/check-boundaries.mjs scripts/check-boundaries.test.mjs \
  apps/web/next.config.ts apps/console/next.config.ts pnpm-lock.yaml
git commit -m "feat(db): switch client.ts to the Workers-compatible neon-serverless driver"
```

---

### Task 2: Convert `apps/web` into a Cloudflare Worker

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/web/open-next.config.ts`
- Modify: `apps/web/next.config.ts`

**Interfaces:**
- Consumes: nothing from Task 1 directly (this task is independent of the driver swap landing first, but should
  come after it so a real build exercises the new driver).
- Produces: `pnpm --filter @pandora/web run cf:build` (builds the Worker bundle to `.open-next/`) and
  `pnpm --filter @pandora/web exec wrangler deploy` / `wrangler deploy --name <name>` (deploys it) — Task 4's CI
  workflow calls both by these exact names.

- [ ] **Step 1: Add the OpenNext and Wrangler devDependencies**

In `apps/web/package.json`, add to `"devDependencies"`:

```json
    "@opennextjs/cloudflare": "^1.0.0",
    "wrangler": "^4.0.0",
```

Run:
```bash
pnpm install
```
Expected: lockfile updates, no errors. (If either package resolves to a different latest major during install,
that's fine — pin whatever `pnpm install` actually resolves; these are floors, not exact pins.)

- [ ] **Step 2: Add the build/deploy scripts**

In `apps/web/package.json`, add to `"scripts"` (keep every existing script as-is):

```json
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "opennextjs-cloudflare build && wrangler dev",
```

(`wrangler deploy`/`wrangler delete` are invoked directly by CI in Task 4, not wrapped in a script, since CI needs
to pass a dynamic `--name` per PR.)

- [ ] **Step 3: Create `open-next.config.ts`**

Create `apps/web/open-next.config.ts`:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

This is OpenNext's required config entry point (analogous to `next.config.ts`, but for the adapter). The default
export with no overrides gives OpenNext its default incremental-cache and queue behavior, which is enough here — we
don't use ISR or Next's Data Cache in a way that needs a custom Cloudflare KV/R2 binding.

- [ ] **Step 4: Create `wrangler.jsonc`**

Create `apps/web/wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "pandora-web",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-29",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  }
}
```

`name` here is the default/production name; Task 4's CI overrides it per PR with `wrangler deploy --name
pandora-web-pr-<N>` without editing this file (Wrangler's `--name` flag takes precedence over the config file's
`name`).

- [ ] **Step 5: Wire local dev mode**

In `apps/web/next.config.ts`, add the OpenNext dev-mode initializer so `pnpm dev` keeps working unchanged (this
call is a no-op unless the app is actually running under `wrangler dev`, so normal `next dev` is unaffected):

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
```

- [ ] **Step 6: Build for Cloudflare**

Run:
```bash
pnpm --filter @pandora/web run cf:build
```
Expected: succeeds, producing a `.open-next/` directory with `worker.js` and an `assets/` folder inside
`apps/web/`. If it fails on a missing environment variable (e.g. `DATABASE_URL`), that's expected in an
environment with no `.env.local` — set a throwaway value (`DATABASE_URL=postgres://example.invalid/db`) just
to get past the build step; the real value is supplied at deploy time via `wrangler secret`, not at build time.

- [ ] **Step 7: Add `.open-next/` to gitignore**

Check the repo's root `.gitignore` for an existing `.next` entry (there should be one, since Next's build output
isn't committed). Add `.open-next/` next to it, in every `.gitignore` that already lists `.next` (root and/or
per-app — check both `.gitignore` and `apps/web/.gitignore` if the latter exists).

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/wrangler.jsonc apps/web/open-next.config.ts apps/web/next.config.ts \
  .gitignore pnpm-lock.yaml
git commit -m "feat(web): add Cloudflare Workers build via OpenNext"
```

---

### Task 3: Convert `apps/console` into a Cloudflare Worker

**Files:**
- Modify: `apps/console/package.json`
- Create: `apps/console/wrangler.jsonc`
- Create: `apps/console/open-next.config.ts`
- Modify: `apps/console/next.config.ts`

**Interfaces:**
- Same shape as Task 2, for `apps/console`. Produces `pnpm --filter @pandora/console run cf:build` and
  `wrangler deploy --name pandora-console[-pr-<N>]`.

- [ ] **Step 1: Add the OpenNext and Wrangler devDependencies**

Same as Task 2 Step 1, in `apps/console/package.json`:

```json
    "@opennextjs/cloudflare": "^1.0.0",
    "wrangler": "^4.0.0",
```

Run: `pnpm install`

- [ ] **Step 2: Add the build/preview scripts**

In `apps/console/package.json`, add to `"scripts"`:

```json
    "cf:build": "opennextjs-cloudflare build",
    "cf:preview": "opennextjs-cloudflare build && wrangler dev",
```

- [ ] **Step 3: Create `open-next.config.ts`**

Create `apps/console/open-next.config.ts`:

```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
```

- [ ] **Step 4: Create `wrangler.jsonc`**

Create `apps/console/wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "pandora-console",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-09-29",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "observability": {
    "enabled": true
  }
}
```

- [ ] **Step 5: Wire local dev mode**

In `apps/console/next.config.ts`, add the same initializer, keeping the existing `headers()` block:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pandora/core", "@pandora/ui", "@pandora/db", "@pandora/email"],
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
```

- [ ] **Step 6: Build for Cloudflare**

Run:
```bash
pnpm --filter @pandora/console run cf:build
```
Expected: succeeds, same caveat about a throwaway `DATABASE_URL` as Task 2 Step 6 if needed.

- [ ] **Step 7: Commit**

```bash
git add apps/console/package.json apps/console/wrangler.jsonc apps/console/open-next.config.ts \
  apps/console/next.config.ts pnpm-lock.yaml
git commit -m "feat(console): add Cloudflare Workers build via OpenNext"
```

---

### Task 4: Replace the deploy workflow with Cloudflare/Wrangler steps

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `pnpm --filter @pandora/<app> run cf:build` and `wrangler` (both from Tasks 2/3); `CLOUDFLARE_API_TOKEN`
  and `CLOUDFLARE_ACCOUNT_ID` (existing repo secrets); the four existing GitHub Environments and their secrets
  (`preview-web`, `preview-console`, `production-web`, `production-console`).
- Produces: preview URLs of the form `pandora-<app>-pr-<N>.<subdomain>.workers.dev`, commented on the PR with the
  same marker-comment pattern as today; production deploys of `pandora-web`/`pandora-console`.

This task has no automated test (it's a CI workflow) — verification is a real PR exercising the whole pipeline in
Step 3.

- [ ] **Step 1: Replace the file**

Replace the full contents of `.github/workflows/deploy.yml`:

```yaml
# Deploys both apps to Cloudflare Workers from GitHub Actions, via the OpenNext adapter.
# Pull requests get their own disposable Worker with a stable URL for the PR's lifetime (commented on the PR,
# deleted when the PR closes); merges to main deploy the production Worker.
name: deploy
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch: # "Run workflow" button in the Actions tab: deploys both apps to production
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
permissions:
  contents: read
  pull-requests: write
env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
jobs:
  # Decide which apps this change affects, so unaffected apps don't deploy at all.
  plan:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      apps: ${{ steps.affected.outputs.apps }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4 # version comes from package.json "packageManager"
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # An app deploys when: run by hand, this workflow file changed, or turbo-ignore says something
      # the app depends on changed since BASE (turbo-ignore exits 0 when nothing did).
      - name: Find affected apps
        id: affected
        env:
          BASE: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}
        run: |
          force=false
          if [ "$GITHUB_EVENT_NAME" = "workflow_dispatch" ] || [ -z "$BASE" ] \
            || git diff --name-only "$BASE" HEAD 2>/dev/null | grep -qx '.github/workflows/deploy.yml'; then
            force=true
          fi
          apps=()
          for entry in "web:pandora-web" "console:pandora-console"; do
            IFS=: read -r app worker_name <<< "$entry"
            if [ "$force" = true ] || ! npx --yes turbo-ignore "@pandora/$app" --fallback="$BASE" > /dev/null 2>&1; then
              apps+=("{\"app\":\"$app\",\"worker_name\":\"$worker_name\"}")
              echo "### $app: deploying" >> "$GITHUB_STEP_SUMMARY"
            else
              echo "### $app: skipped (no changes affect it)" >> "$GITHUB_STEP_SUMMARY"
            fi
          done
          echo "apps=[$(IFS=,; echo "${apps[*]}")]" >> "$GITHUB_OUTPUT"

  # Apply database migrations to the target environment before any app deploys against it.
  migrate:
    needs: plan
    if: needs.plan.outputs.apps != '[]'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: ${{ github.event_name == 'pull_request' && 'preview-web' || 'production-web' }}
    env:
      DATABASE_MIGRATE_URL: ${{ secrets.DATABASE_MIGRATE_URL }}
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Apply migrations
        run: |
          if [ -z "${DATABASE_MIGRATE_URL:-$DATABASE_URL}" ]; then
            echo "::warning::Neither DATABASE_MIGRATE_URL nor DATABASE_URL is set for this environment; skipping migrations."
            exit 0
          fi
          pnpm --filter @pandora/db migrate

  deploy:
    needs: [plan, migrate]
    if: needs.plan.outputs.apps != '[]'
    name: deploy (${{ matrix.app }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        include: ${{ fromJSON(needs.plan.outputs.apps) }}
    environment:
      name: ${{ github.event_name == 'pull_request' && format('preview-{0}', matrix.app) || format('production-{0}', matrix.app) }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Build
        run: pnpm --filter @pandora/${{ matrix.app }} run cf:build
      - name: Determine the Worker name for this deploy
        id: name
        run: |
          if [ "$GITHUB_EVENT_NAME" = "pull_request" ]; then
            echo "worker_name=${{ matrix.worker_name }}-pr-${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"
          else
            echo "worker_name=${{ matrix.worker_name }}" >> "$GITHUB_OUTPUT"
          fi
      - name: Push secrets to the Worker
        working-directory: apps/${{ matrix.app }}
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DATABASE_MIGRATE_URL: ${{ secrets.DATABASE_MIGRATE_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          PASS_SECRET: ${{ secrets.PASS_SECRET }}
          MAIL_ALLOWLIST: ${{ secrets.MAIL_ALLOWLIST }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
        run: |
          json="{}"
          for key in DATABASE_URL DATABASE_MIGRATE_URL RESEND_API_KEY EMAIL_FROM PASS_SECRET MAIL_ALLOWLIST SUPABASE_URL SUPABASE_SECRET_KEY; do
            value="${!key:-}"
            if [ -n "$value" ]; then
              json=$(node -e "const o=$json; o[process.argv[1]]=process.argv[2]; console.log(JSON.stringify(o))" "$key" "$value")
            fi
          done
          echo "$json" | npx --yes wrangler@latest secret bulk --name "${{ steps.name.outputs.worker_name }}"
      - name: Deploy
        id: deploy
        working-directory: apps/${{ matrix.app }}
        run: |
          url=$(npx --yes wrangler@latest deploy --name "${{ steps.name.outputs.worker_name }}" 2>&1 | tee /dev/stderr | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | tail -n1)
          echo "url=$url" >> "$GITHUB_OUTPUT"
          echo "### ${{ matrix.app }}: $url" >> "$GITHUB_STEP_SUMMARY"
      - name: Comment the preview link on the pull request
        if: github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ github.token }}
          URL: ${{ steps.deploy.outputs.url }}
          PR: ${{ github.event.pull_request.number }}
        run: |
          marker="<!-- pandora-preview:${{ matrix.app }} -->"
          body="$marker
          **Preview (${{ matrix.app }}):** $URL"
          id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
            --jq ".[] | select(.body | startswith(\"$marker\")) | .id" | head -n1)
          if [ -n "$id" ]; then
            gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" > /dev/null
          else
            gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" -f body="$body" > /dev/null
          fi

  # Deletes a PR's preview Workers when the PR closes (merged or not), so closed PRs don't leave live Workers
  # (and their secrets) behind. Cloudflare has no automatic preview expiry the way Vercel did.
  pr-preview-cleanup:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Delete this PR's Workers
        run: |
          for name in "pandora-web-pr-${{ github.event.pull_request.number }}" "pandora-console-pr-${{ github.event.pull_request.number }}"; do
            npx --yes wrangler@latest delete --name "$name" --force || true
          done
```

Notes on choices in this file, so the reviewer understands them without re-deriving them:
- `on: pull_request` with no `types:` filter also fires on `closed`, which is what `pr-preview-cleanup` needs;
  the other jobs' `if: needs.plan.outputs.apps != '[]'` guards mean they simply do nothing useful on a `closed`
  event without a code change (harmless, low-cost run).
- `migrate`'s `environment:` is pinned to the `-web` variant of whichever target, since both apps' database
  secrets hold identical values (per the spec) and the migration only needs to run once per push regardless of
  which app(s) are affected.
- The secrets-push step builds a JSON object with only the keys that have a non-empty value, so `preview`
  environments (which don't set `SUPABASE_*`) don't push empty strings, and `wrangler secret bulk` receives valid
  JSON piped via stdin — the value never touches a file or gets echoed by `set -x`/`-v` (this script doesn't use
  either).

- [ ] **Step 2: Sanity-check the YAML**

Run:
```bash
node -e "require('js-yaml') ? null : 0" 2>/dev/null; npx --yes -p js-yaml -- js-yaml .github/workflows/deploy.yml > /dev/null && echo "valid YAML"
```
Expected: prints `valid YAML`. (If `js-yaml` isn't available via npx in this environment, opening the file and
checking indentation by eye is an acceptable fallback — there's no unit test for a workflow file.)

- [ ] **Step 3: Open a real PR to exercise the pipeline**

This step can't be simulated locally — Wrangler needs `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, which only
exist as GitHub Actions secrets. Push this branch, open a PR, and watch the `deploy` workflow run in the Actions
tab. Expected: `plan` finds both apps affected (since `deploy.yml` itself changed), `migrate` runs (or skips
cleanly if no DB secret is set yet), and `deploy` succeeds for both apps with a preview-link comment posted on the
PR. If `wrangler deploy` fails, read its error — the most likely causes are a missing secret (Task 4 Step 1's
secrets-push step only pushes secrets that have a value; a genuinely required one that's still empty will surface
as a runtime error on first request, not a deploy-time error, so also open the preview URL and check it renders)
or an account-token permission issue (re-check the token has `Workers Scripts: Edit` at the account level).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat(ci): deploy to Cloudflare Workers instead of Vercel"
```

---

### Task 5: Document the change

**Files:**
- Create: `docs/tech/cloudflare.md`
- Modify: `docs/tech/vercel.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Write `docs/tech/cloudflare.md`**

Create `docs/tech/cloudflare.md`, matching the style of `docs/tech/lefthook.md` (What it is / Why here / Instead
of / In this repo / Read next):

```markdown
# Cloudflare Workers

**What it is.** A serverless platform: code runs at Cloudflare's edge, in a JavaScript runtime called `workerd`,
not on a server you manage. `wrangler` is its CLI for building, testing and deploying.

**Why here.** Vercel's Hobby plan blocks any deployment whose git commit author isn't the account owner — since
every associate's commit trips that, deploys never ran. Cloudflare has no such restriction, and its free tier
comfortably covers this event's traffic.

**Instead of.** Vercel (see the note this replaces, below): correct here, but blocked on the free plan for a
private organization repo with multiple committers. A VPS or container platform: much more to manage ourselves.

**In this repo.** Each app (`apps/web`, `apps/console`) is one Cloudflare Worker, built from its Next.js output by
`@opennextjs/cloudflare` (`pnpm --filter @pandora/web run cf:build`, then `wrangler deploy`). `wrangler.jsonc` in
each app configures the Worker; `open-next.config.ts` configures the adapter. `.github/workflows/deploy.yml` builds
and deploys both apps: every pull request gets its own disposable Worker (`pandora-<app>-pr-<N>`, deleted when the
PR closes) with a link commented on the PR; every merge to `main` deploys production (`pandora-web`,
`pandora-console`). Because Workers run in `workerd`, not Node, `packages/db`'s client uses
`drizzle-orm/neon-serverless` (works over WebSocket) instead of the `pg` driver — see `docs/tech/drizzle.md`.
Local `pnpm dev` is unaffected (`next dev` still runs in Node); `pnpm --filter @pandora/web run cf:preview` runs a
build against the real Workers runtime locally, for whenever that distinction matters. If a production deploy
misbehaves, `npx wrangler@latest rollback --name pandora-web` (or `pandora-console`) reverts to the previous
version.

**Read next.** https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
```

- [ ] **Step 2: Update `docs/tech/vercel.md`**

Replace the full contents of `docs/tech/vercel.md`:

```markdown
# Vercel (replaced)

This project deployed to Vercel from project start through September 2026. Vercel's Hobby plan blocks any
deployment whose git commit author isn't the account owner, which meant every associate's push was blocked from
deploying — see `docs/tech/cloudflare.md` for what replaced it and why.

**What it was.** Two Vercel projects, `pandora-web` (root directory `apps/web`) and `pandora-console` (root
directory `apps/console`), deployed by `.github/workflows/deploy.yml` via the Vercel CLI (not Vercel's own Git
integration, which needs a paid plan for a private organization repo).

**Read next.** `docs/tech/cloudflare.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/tech/cloudflare.md docs/tech/vercel.md
git commit -m "docs: add cloudflare.md, mark vercel.md as replaced"
```
