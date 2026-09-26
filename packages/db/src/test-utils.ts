import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import type { Db } from "./client";
import * as schema from "./schema";

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

// A fresh in-memory Postgres with every migration applied. One per test file (or per test when isolation matters).
export async function createTestDb(): Promise<Db> {
  const db = drizzle({ client: new PGlite(), schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  return db as unknown as Db;
}
