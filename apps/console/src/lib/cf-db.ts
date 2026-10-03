import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb, type Db } from "@pandora/db";

// The Hyperdrive binding wrangler.jsonc gives this Worker in its "preview"/"production" environments. Optional
// because it's absent in local dev and tests, where DATABASE_URL is used instead.
declare global {
  interface CloudflareEnv {
    HYPERDRIVE?: { connectionString: string };
  }
}

// The Hyperdrive connection string, or undefined anywhere that has no Workers binding: local dev, tests, and the
// production build served from Vercel (where VERCEL is set and there is no Cloudflare context to ask).
async function hyperdriveUrl(): Promise<string | undefined> {
  if (process.env.VERCEL) return undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.HYPERDRIVE?.connectionString;
  } catch {
    return undefined;
  }
}

// A fresh Db per call — never cache this across requests. Workers forbids reusing an I/O object (a socket, here)
// across requests, and Hyperdrive is designed for exactly this: it keeps the real connection pool warm on
// Cloudflare's side, so creating a client per request is fast, not wasteful.
export async function getDb(): Promise<Db> {
  const url = (await hyperdriveUrl()) ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("No database connection available (neither a HYPERDRIVE binding nor DATABASE_URL is set).");
  }
  return createDb(url);
}
