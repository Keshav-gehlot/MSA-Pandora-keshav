import { sql } from "drizzle-orm";
import type { Db } from "../client";

/** Throws if the database can't be reached; used by the web app's health endpoint. */
export async function pingDatabase(db: Db): Promise<void> {
  await db.execute(sql`select 1`);
}
