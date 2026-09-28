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
`pandora-console`). `packages/db` still uses the plain `pg` driver — Workers can't keep a pooled connection alive
across requests, so a **Cloudflare Hyperdrive** binding fronts each database instead (Hyperdrive keeps the real
pool warm on Cloudflare's side; each app gets a fresh `Db` per request via `apps/<app>/src/lib/cf-db.ts`, which
reads `env.HYPERDRIVE.connectionString`, not `DATABASE_URL`). See `docs/tech/drizzle.md`.
Local `pnpm dev` is unaffected (`next dev` still runs in Node, falling back to `DATABASE_URL` with no Hyperdrive
binding); `pnpm --filter @pandora/web run cf:preview` runs a
build against the real Workers runtime locally, for whenever that distinction matters. If a production deploy
misbehaves, `npx wrangler@latest rollback --name pandora-web` (or `pandora-console`) reverts to the previous
version.

**Read next.** https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
