import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The URL the migrate and seed scripts connect to: DATABASE_MIGRATE_URL, else DATABASE_URL. When neither is set in
// the shell, apps/web/.env.local is loaded, so `pnpm --filter @pandora/db migrate` just works on a dev machine.
export function databaseUrl(): string | undefined {
  if (!process.env.DATABASE_MIGRATE_URL && !process.env.DATABASE_URL) {
    const envFile = fileURLToPath(new URL("../../../apps/web/.env.local", import.meta.url));
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
  return process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL || undefined;
}
