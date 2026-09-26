import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

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
