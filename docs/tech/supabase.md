# Supabase

**What it is.** A hosted Postgres database plus extras: file storage, auth and a dashboard for browsing data.

**Why here.** We need a real Postgres database and private file storage (payment proofs, photos) without running
servers. MSA already has Supabase projects for msa-auth.

**Instead of.** Running Postgres ourselves (someone has to operate it), or Firebase (not SQL, and harder to query for
admin views like "every team pending payment review").

**In this repo.** The database is reached through `packages/db` (Drizzle), not the Supabase JS client. Development and
pull request previews use a dev project; production has its own project, and production data is never used for development.

**Read next.** https://supabase.com/docs/guides/database/overview
