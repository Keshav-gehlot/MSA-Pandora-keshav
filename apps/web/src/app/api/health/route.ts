import { pingDatabase } from "@pandora/db";
import { getDb } from "../../../lib/cf-db";

// A read-only check an operator can open in a browser: can this deployment reach its database, and which settings
// does it have? It never returns a setting value: booleans, the shape of the database URL, and scrubbed error text.
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

// A connection error's message normally names the failure (timeout, refused, auth), but strip anything shaped like
// a connection URL or credentials, and cap the length, so this endpoint can never echo a secret.
function scrub(message: string): string {
  return message
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<url>")
    .replace(/password[^,;]*/gi, "password <hidden>")
    .slice(0, 160);
}

// The shape of the stored database URL with the credentials and the first part of the host removed: enough to compare
// against a working URL (same kind of host, same port, same options) without revealing anything secret.
function describeUrl(raw: string | undefined) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      protocol: url.protocol,
      host: url.hostname.split(".").slice(1).join(".") || "(single label)",
      port: url.port || "(default)",
      database: url.pathname.slice(1),
      options: [...url.searchParams.keys()],
    };
  } catch {
    return "unparseable";
  }
}

// Drizzle wraps the driver's error ("Failed query: ..."); the real reason is on the cause chain.
function describeError(error: unknown) {
  const chain: Array<{ name: string; code?: string; message: string }> = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    const code = (current as { code?: unknown }).code;
    chain.push({
      name: current.name,
      code: typeof code === "string" ? code : undefined,
      message: scrub(current.message),
    });
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

export async function GET() {
  const settings = Object.fromEntries(SETTINGS.map((name) => [name, Boolean(process.env[name])]));
  let database: { ok: true } | { ok: false; errors: ReturnType<typeof describeError> };
  try {
    await pingDatabase(await getDb());
    database = { ok: true };
  } catch (error) {
    database = { ok: false, errors: describeError(error) };
  }
  return Response.json(
    { database, settings, connection: describeUrl(process.env.DATABASE_URL) },
    { status: database.ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
