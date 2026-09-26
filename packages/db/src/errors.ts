export type UniqueField = "teamName" | "regNumber" | "srmEmail";

const UNIQUE_VIOLATION = "23505";
const FIELD_BY_CONSTRAINT: Record<string, UniqueField> = {
  teams_name_key_unique: "teamName",
  members_reg_number_unique: "regNumber",
  members_srm_email_unique: "srmEmail",
};

type PgErrorShape = { code?: unknown; constraint?: unknown; cause?: unknown };

function fieldOf(value: unknown): UniqueField | null {
  if (typeof value !== "object" || value === null) return null;
  const { code, constraint } = value as PgErrorShape;
  if (code !== UNIQUE_VIOLATION || typeof constraint !== "string") return null;
  return FIELD_BY_CONSTRAINT[constraint] ?? null;
}

// Which registration field a failed insert collided on, so a flow can show "already registered" next to it.
// Drizzle wraps driver errors, so the Postgres code and constraint may sit on the error or on its `cause`.
export function uniqueViolationField(error: unknown): UniqueField | null {
  if (typeof error !== "object" || error === null) return null;
  return fieldOf(error) ?? fieldOf((error as PgErrorShape).cause);
}
