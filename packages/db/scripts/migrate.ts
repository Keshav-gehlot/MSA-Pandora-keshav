// Applies every pending migration in ../drizzle. Run with `pnpm --filter @pandora/db migrate`.
// One connection holds a Postgres advisory lock for the whole run, so two deploys migrating the same database at
// once take turns instead of racing. Session-level locks need a real session: in production DATABASE_MIGRATE_URL
// must be Supabase's session pooler (port 5432), not the transaction pooler.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { databaseUrl } from "./env";

const MIGRATION_LOCK_ID = 727274;
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

const url = databaseUrl();
if (!url) {
  console.error("Set DATABASE_MIGRATE_URL or DATABASE_URL (in your shell or apps/web/.env.local).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
  try {
    await migrate(drizzle({ client, casing: "snake_case" }), { migrationsFolder });
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]);
  }
  console.log("Migrations applied");
} finally {
  await client.end();
}
