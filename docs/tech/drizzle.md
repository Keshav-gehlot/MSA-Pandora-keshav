# Drizzle ORM

**What it is.** A TypeScript library for talking to SQL databases. You describe tables in TypeScript, write queries
that TypeScript type-checks, and `drizzle-kit` generates SQL migration files from schema changes.

**Why here.** Queries stay close to real SQL (easy to learn, easy to debug) while TypeScript catches wrong column
names at build time. msa-auth uses it, so MSA already knows its quirks.

**Instead of.** Prisma: heavier, with its own schema language and a generated client. The Supabase JS client alone:
fine for simple reads, but no typed schema or migrations of our own.

**In this repo.** Only `packages/db` depends on Drizzle. Apps call the functions it exports.

**Read next.** https://orm.drizzle.team/docs/overview
