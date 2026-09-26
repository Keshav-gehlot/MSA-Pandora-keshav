// Fills the dev database with staff accounts (and, with --fake-teams, three sample teams).
// Run with `pnpm --filter @pandora/db seed [-- --fake-teams]`. Refuses to run against production.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Db } from "../src/client";
import * as schema from "../src/schema";
import { databaseUrl } from "./env";
import { parseSeedStaff, seedFakeTeams, seedRefusal, seedStaff } from "./seed-lib";

const url = databaseUrl();
const refusal = seedRefusal({ url, vercelEnv: process.env.VERCEL_ENV });
if (refusal || !url) {
  console.error(`Not seeding: ${refusal}`);
  process.exit(1);
}

const entries = parseSeedStaff(process.env.SEED_STAFF);
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const db: Db = drizzle({ client: pool, schema, casing: "snake_case" });
  await seedStaff(db, entries);
  console.log(`Staff seeded: ${entries.length}`);
  if (process.argv.includes("--fake-teams")) {
    console.log(`Fake teams created: ${await seedFakeTeams(db)}`);
  }
} finally {
  await pool.end();
}
