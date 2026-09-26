# Drizzle ORM

**What it is.** A TypeScript library for talking to SQL databases. You describe tables in TypeScript, write queries
that TypeScript type-checks, and `drizzle-kit` generates SQL migration files from schema changes.

**Why here.** Queries stay close to real SQL (easy to learn, easy to debug) while TypeScript catches wrong column
names at build time. msa-auth uses it, so MSA already knows its quirks.

**Instead of.** Prisma: heavier, with its own schema language and a generated client. The Supabase JS client alone:
fine for simple reads, but no typed schema or migrations of our own.

**In this repo.** Only `packages/db` depends on Drizzle. Apps call the functions it exports. The driver is `pg`
(node-postgres); tests run the same queries against PGlite, an in-memory Postgres.

**Migration rules.**

- Schema change → `pnpm --filter @pandora/db generate` → commit the generated SQL with your pull request. The deploy
  workflow migrates the shared preview database (Neon) on every pull request push, and production (Supabase) on
  merge, before the apps deploy.
- Never edit a migration after it has been pushed; add a new one.
- If `main` gained a migration after you generated yours: delete yours, rebase, and `generate` again. Drizzle skips
  migrations older than the last one applied, and `meta/_journal.json` conflicts otherwise.
- Migrations run before the apps deploy, so avoid destructive changes in one step: add → backfill → switch → remove,
  in later pull requests.
- Run migrations against the dev database yourself: `pnpm --filter @pandora/db migrate` (reads `DATABASE_URL` from
  your shell or `apps/web/.env.local`). `pnpm --filter @pandora/db seed` adds staff and sample teams; see
  `packages/db/AGENTS.md`.
- Production sets `DATABASE_MIGRATE_URL` to Supabase's session pooler (port 5432) for migrations: the migrate script
  holds a session-level advisory lock, which the transaction pooler can't keep.

**Read next.** https://orm.drizzle.team/docs/overview
