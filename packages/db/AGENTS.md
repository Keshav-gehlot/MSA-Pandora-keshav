# packages/db

The only code that talks to the database: Drizzle schema, migrations and query functions. Issues carry the
`area:db` label.

- Apps never import `drizzle-orm` or `pg` themselves; they call functions exported from here.
- The driver is `pg` (node-postgres). Write queries against the `Db` type from `./client`, never a driver-specific
  type, so the same code runs in tests (PGlite) and in the apps (`pg`). A transaction (`tx`) is a `Db` too.
- Tests use `createTestDb()` from `@pandora/db/test-utils`: an in-memory Postgres with every migration applied. Never
  point tests at a real database.
- Put a flow's queries in `src/queries/<flow>.ts` (`registration`, `participant`, `admin`, `checkin`), so flow owners
  rarely touch the same file.
- Give every unique constraint and index an explicit snake_case name (`unique("members_srm_email_unique").on(...)`).
  `uniqueViolationField(error)` maps the registration constraints to the form field that collided.

## Migrations

- Schema change → `pnpm --filter @pandora/db generate` → commit the generated SQL (and `drizzle/meta/`) in the same
  pull request. The deploy workflow migrates the shared preview database (Neon) on every pull request push and
  production (Supabase) on merge to `main`.
- Never edit a migration after it has been pushed. Add a new one.
- If `main` gained a migration after you generated yours: delete yours, rebase, and `generate` again. Drizzle skips
  migrations older than the last one applied, and `drizzle/meta/_journal.json` conflicts otherwise.
- Migrations run before the apps deploy, so the old app version runs against the new schema for a while. Avoid
  destructive changes in one step: add → backfill → switch the code → remove, in separate pull requests.
- `pnpm --filter @pandora/db migrate` applies pending migrations (`scripts/migrate.ts`). It connects to
  `DATABASE_MIGRATE_URL`, else `DATABASE_URL`, from your shell or `apps/web/.env.local`, and holds a Postgres advisory
  lock so two deploys never migrate at once. Run it yourself against the dev database after pulling a new migration.
- Production sets `DATABASE_MIGRATE_URL` to Supabase's **session** pooler (port 5432): the advisory lock needs a real
  session, which the transaction pooler (port 6543) doesn't give.

## Seeding the dev database

`pnpm --filter @pandora/db seed` (`scripts/seed.ts`) reads the same URL as `migrate`. It refuses to run when the host
is Supabase (`*.supabase.com` or `*.supabase.co`) or `VERCEL_ENV` is `production`.

- Staff: `SEED_STAFF="you@srmist.edu.in:Your Name:admin;friend@srmist.edu.in:Friend:staff"` (role `admin` or
  `staff`). Emails are lower-cased; running it again updates names and roles.
- `pnpm --filter @pandora/db seed -- --fake-teams` also creates three sample teams ("Seed Team One/Two/Three", with
  `seed.<n>.<m>@srmist.edu.in` members). Teams that already exist are skipped, so it's safe to re-run.
