import { pingDatabase } from "@pandora/db";
import { getDb } from "../../../lib/cf-db";

// A read-only check an operator can open in a browser: can this deployment reach its database, and which settings
// does it have? It never returns a value or a message that could carry one, only booleans and an error code.
export const dynamic = "force-dynamic";

const SETTINGS = [
  "DATABASE_URL",
  "PASS_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "MAIL_TRANSPORT",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "DEPLOY_TARGET",
] as const;

export async function GET() {
  const settings = Object.fromEntries(SETTINGS.map((name) => [name, Boolean(process.env[name])]));
  let database: { ok: true } | { ok: false; error: string };
  try {
    await pingDatabase(await getDb());
    database = { ok: true };
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    database = { ok: false, error: typeof code === "string" ? code : error instanceof Error ? error.name : "unknown" };
  }
  return Response.json({ database, settings }, { status: database.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
