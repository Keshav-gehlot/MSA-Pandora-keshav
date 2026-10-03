import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { diskStorage, r2Storage, type R2BucketLike, type Storage } from "@pandora/db";

// The R2 bucket wrangler.jsonc binds to this Worker in its "preview"/"production" environments. Optional because
// it's absent in local dev and tests, where files go to .storage/ on disk instead.
declare global {
  interface CloudflareEnv {
    UPLOADS?: R2BucketLike;
  }
}

// Not cached: a binding belongs to the request it came from, like the database connection (see cf-db.ts).
export async function getStorage(): Promise<Storage> {
  const { env } = await getCloudflareContext({ async: true });
  if (env.UPLOADS) return r2Storage(env.UPLOADS);
  // A deployed instance's disk is temporary (and virtual on Workers): files written there would be lost.
  if (process.env.DEPLOY_TARGET) {
    throw new Error("No UPLOADS (R2) binding is available, but DEPLOY_TARGET is set; check wrangler.jsonc.");
  }
  return diskStorage(".storage");
}
