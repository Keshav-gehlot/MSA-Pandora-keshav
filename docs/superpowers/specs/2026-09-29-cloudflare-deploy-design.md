# MSA Pandora: Cloudflare Deploy Design

**Status:** Approved in conversation 2026-09-28/29; **amended 2026-09-29** (decision 4 below) after the final
branch review found the original driver choice would fail against production and violate a Workers runtime rule —
see "Amendment" under decision 4.
**Replaces:** the Vercel-based `.github/workflows/deploy.yml` (see `docs/tech/vercel.md`)

## 1. Problem

Vercel's Hobby plan **blocks any deployment whose git commit author isn't the account owner**. Every associate's
commit trips this, so the `deploy` job in CI hangs for ~15 minutes waiting on a deployment that Vercel will never
start, then gets cancelled — wasting Actions minutes on every push and giving no preview link. This has blocked
deploys since the team started pushing code. We are moving both apps to Cloudflare Workers, which has no such
restriction, and reusing as much of the existing CI shape as possible so the change to associates' workflow is
just "the preview link comes from a different domain."

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Cloudflare **Workers** (not Pages), via `@opennextjs/cloudflare` | Cloudflare's actively maintained Next.js adapter; Pages' Next.js support (`@cloudflare/next-on-pages`) has more feature gaps and less investment now that Pages is folding into Workers. |
| 2 | PR previews are a **separate named Worker per PR** (`pandora-<app>-pr-<N>`), not a router Worker | Gives a URL that's stable for the PR's whole life with no extra moving part (no router, no DNS). Deleted when the PR closes. |
| 3 | Runtime secrets delivered via **`wrangler secret` at deploy time**, sourced from **GitHub Environment secrets** (`preview`, `production`) | Keeps the same trust boundary as today (secrets live in one place, CI reads them, they're never baked into a bundle or echoed in logs) while using Wrangler's own secret store as the runtime boundary, matching how `vercel pull` worked before. |
| 4 | `packages/db` **keeps `drizzle-orm/node-postgres` + `pg`**, fronted by **Cloudflare Hyperdrive** for pooling; `createDb(url)` is called fresh per request, never cached at module scope | See "Amendment" below — supersedes the original `neon-serverless` choice. |
| 5 | `migrate.ts` and `seed.ts` **keep using `pg`** | They run in Node (GitHub Actions or a developer's machine), never inside a Worker, and need a real session-level Postgres connection for `migrate.ts`'s advisory lock. Only the app runtime's `client.ts` needs to change. |
| 6 | Ojas creates the Cloudflare account, an API token scoped to **Workers Scripts (Edit)** + **Account Settings (Read)**, applied to the entire account | Same pattern as the Vercel token: Claude's GitHub token is deliberately narrow and can't write repo secrets. (User-level permissions like "User Details"/"Memberships" aren't offered on an account-scoped token and aren't needed.) |

### Amendment (2026-09-29): the original driver choice was wrong

`drizzle-orm/neon-serverless` was chosen for transaction support, but its `Pool`/`Client` only speak to **Neon's
own WebSocket proxy** — confirmed directly from `@neondatabase/serverless`'s own README: "This package comes
configured to connect to a Neon database. But you can also use it to connect to your own Postgres instances if you
run your own WebSocket proxy." Supabase (production) runs no such proxy, so production would never have connected.
Separately, `getDb()`'s module-level cached `Pool` violates a Workers runtime rule that applies to *any* I/O
object, not just this driver: "WebSocket connections can't outlive a single request... Don't create them outside a
request handler; don't create them in one handler and try to reuse them in another" (same README). A cached
connection reused across requests fails or hangs on the second request in a warm isolate.

**Corrected decision:** revert to `drizzle-orm/node-postgres` + `pg` (works with both Neon and Supabase — they
both speak plain Postgres wire protocol), and front it with **Cloudflare Hyperdrive**, Cloudflare's own product
for exactly this situation (pooling a traditional DB driver from a Worker). This is Cloudflare's officially
documented pattern for node-postgres: create a fresh `pg` client from `env.HYPERDRIVE.connectionString` inside
each request handler; Hyperdrive keeps the real connection pool warm on Cloudflare's side, so "create fresh per
request" is fast, not wasteful. Two Hyperdrive configs are needed (`pandora-preview-db` → Neon,
`pandora-production-db` → Supabase), created once by Ojas via `wrangler hyperdrive create` — the connection string
lives inside the Hyperdrive config itself, not as a Workers secret, and Ojas never pastes it anywhere but that one
command. `wrangler.jsonc` gains named environments (`preview`, `production`), each with its own `hyperdrive`
binding (`{ "binding": "HYPERDRIVE", "id": "<hyperdrive-id>" }`) and a `vars.DEPLOY_TARGET` string; CI's `wrangler
deploy` gains `--env preview`/`--env production` alongside the existing `--name` override (Wrangler ≥4.16 lets
`--name` override the env's worker-name suffix, confirmed against the current resolved wrangler 4.143.0).

Because `packages/db` must stay framework-agnostic (no `@opennextjs/cloudflare` import — see AGENTS.md boundary
rules), `getDb()` moves out of `@pandora/db` entirely. Each app gets its own small `getDb()` in
`apps/<app>/src/lib/cf-db.ts`, which reads `env.HYPERDRIVE.connectionString` via `@opennextjs/cloudflare`'s
`getCloudflareContext({ async: true })` (falling back to `process.env.DATABASE_URL` when no Hyperdrive binding is
configured, e.g. plain `next dev`), and calls `@pandora/db`'s `createDb(url)` fresh every call — no caching.
`createDb(url): Db` itself is otherwise unchanged from before Task 1 (a `Pool({ connectionString: url, max: 5 })`
factory); only `getDb()`'s caching behavior and location change.

`DATABASE_URL` is no longer pushed to the Worker as a secret (the connection string lives in the Hyperdrive config
instead); `DATABASE_MIGRATE_URL` is still pushed, but only `migrate.ts` (Node, unaffected by any of this) uses it.

## 3. Architecture

Each app (`apps/web`, `apps/console`) becomes one Cloudflare Worker:

- `apps/web` → Worker `pandora-web` (production), `pandora-web-pr-<N>` (per open PR)
- `apps/console` → Worker `pandora-console` (production), `pandora-console-pr-<N>` (per open PR)

Both apps get a `wrangler.jsonc` with `compatibility_flags: ["nodejs_compat"]` and `main` pointing at the
`@opennextjs/cloudflare` build output. `next.config.ts` in each app gets the OpenNext dev-mode initialization
(`initOpenNextCloudflareForDev()`) so `pnpm dev` keeps working unchanged locally.

Both Workers deploy under the account's `*.workers.dev` subdomain (`helloojasmutreja.workers.dev`) — no custom
domain or Cloudflare zone is configured in this phase. A custom domain (`pandora.msasrm.in`) can be added later as
a Worker Route without changing anything else in this design.

## 4. CI workflow

`.github/workflows/deploy.yml` keeps its current shape — `plan` → `migrate` → `deploy` — with Vercel-specific steps
replaced:

**`plan`** (unchanged): `turbo-ignore` decides which app(s) this push affects; unaffected apps skip entirely.
Force-deploys both on `workflow_dispatch`, a change to `deploy.yml` itself, or when there's no base to diff against.

**`migrate`**: pulls `DATABASE_MIGRATE_URL` from the GitHub Environment (`preview` for PRs, `production` for
`main`) instead of `vercel pull`, then runs `pnpm --filter @pandora/db migrate` exactly as today (advisory-locked,
so concurrent deploys can't race).

**`deploy`** (matrix over affected apps):
1. `pnpm --filter @pandora/<app> build` — the app's OpenNext build script (wraps `opennextjs-cloudflare build`).
2. Push secrets: `wrangler secret bulk` reads a JSON blob built from that environment's GitHub secrets, piped via
   stdin (never written to a file or echoed to logs).
3. Deploy:
   - PR: `wrangler deploy --name pandora-<app>-pr-<N>`. URL: `pandora-<app>-pr-<N>.<subdomain>.workers.dev`.
   - `main`: `wrangler deploy --name pandora-<app>`.
4. Comment/update the preview link on the PR (same marker-comment pattern as today, new URL format).

**New `pr-preview-cleanup` job**, triggered on `pull_request: closed`: `wrangler delete --name pandora-<app>-pr-<N>`
for both apps. Workers don't expire old previews on their own the way Vercel did, so this is new — without it,
closed PRs leave live Workers (and their secrets) behind indefinitely.

## 5. Secrets

Four GitHub **Environments** already exist, carried over from the Vercel setup (one per app per target, matching
the existing `${preview|production}-${matrix.app}` naming the old workflow already used): `preview-web`,
`preview-console`, `production-web`, `production-console`. Each holds:

| Environment | Holds |
|---|---|
| `preview-web`, `preview-console` | `DATABASE_URL`/`DATABASE_MIGRATE_URL` (Neon), `RESEND_API_KEY`, `EMAIL_FROM`, `PASS_SECRET`, `MAIL_ALLOWLIST` |
| `production-web`, `production-console` | `DATABASE_URL`/`DATABASE_MIGRATE_URL` (Supabase), `RESEND_API_KEY`, `EMAIL_FROM`, `PASS_SECRET`, Supabase keys |

The new workflow keeps this same four-way split (no consolidation) so nothing needs re-entering. The `migrate` job
runs once per push, before the matrix, and needs a target's DB URL — it reads `DATABASE_MIGRATE_URL` from
`preview-web`/`production-web` (arbitrarily "web", since both apps' DB env vars are identical values copied to both
environments; `migrate` only runs the migration once regardless of which apps are affected).

Two new **repository** secrets (account-wide, not per-environment): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## 6. Error handling and rollback

`wrangler deploy` is atomic per Worker — a failed build never touches the live Worker, the same property Vercel
gave us. Cloudflare retains prior versions; `wrangler rollback --name pandora-<app>` reverts production to the
previous deploy if a `main` push misbehaves. The advisory lock in `migrate.ts` is unchanged, so two deploys
targeting the same database still can't race each other.

## 7. Testing and verification

No new automated tests — this is infrastructure, not application logic. Verification is:
1. `pnpm --filter @pandora/web build` (OpenNext build) succeeds locally.
2. `wrangler dev` serves the app locally against the Neon dev database.
3. A real PR exercises the whole pipeline (migrate → deploy → preview URL → PR comment) before trusting it on
   `main`.

## 8. Migration / cutover plan

1. Build this on its own branch/PR; that PR's own preview deploy is the first real test of the pipeline.
2. Once verified, merge directly — Vercel is already non-functional, so there's no need to run both in parallel.
3. Ojas deletes (or leaves dormant) the two Vercel projects once Cloudflare deploys look right for a few days.
4. Add `docs/tech/cloudflare.md` (same style as `docs/tech/lefthook.md`) explaining what changed and why, and
   update `docs/tech/vercel.md` to point at it.

## 9. Out of scope

- A custom domain / Cloudflare zone (`pandora.msasrm.in`) — Worker Routes can be added later without changing this
  design.
- Cloudflare Access / Zero Trust in front of any Worker — not needed; the public site and console stay open the
  way they are today (console has its own noindex header and session auth already).
- KV, R2, Durable Objects, Queues, Containers — nothing in Pandora needs them; the API token intentionally excludes
  them.
