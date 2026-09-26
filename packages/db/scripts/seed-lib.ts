import { SRM_EMAIL_DOMAIN, teamNameKey } from "@pandora/core";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../src/client";
import { members, staff, teams } from "../src/schema";

// Why the seed script must not run against this database, or null when it may. Never includes the URL itself.
export function seedRefusal({ url, vercelEnv }: { url: string | undefined; vercelEnv: string | undefined }): string | null {
  if (vercelEnv === "production") return "VERCEL_ENV is production. The seed script only runs against the dev database.";
  if (!url) return "DATABASE_URL is not set (in your shell or apps/web/.env.local).";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "The database URL is not a valid URL.";
  }
  const supabase = ["supabase.com", "supabase.co"].some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (supabase) return "The database URL points at Supabase (production). The seed script only runs against the dev database.";
  return null;
}

export type SeedStaff = { email: string; name: string; role: "admin" | "staff" };

// SEED_STAFF="email:Name:role;email:Name:role", role admin or staff.
export function parseSeedStaff(value: string | undefined): SeedStaff[] {
  if (!value?.trim()) return [];
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":").map((part) => part.trim());
      if (parts.length !== 3 || parts.some((part) => !part)) {
        throw new Error(`SEED_STAFF entries look like email:Name:role, got "${entry}"`);
      }
      const [rawEmail, name, role] = parts as [string, string, string];
      const email = rawEmail.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`SEED_STAFF has an invalid email: "${rawEmail}"`);
      if (role !== "admin" && role !== "staff") throw new Error(`SEED_STAFF roles are admin or staff, got "${role}"`);
      return { email, name, role };
    });
}

export async function seedStaff(db: Db, entries: SeedStaff[]): Promise<void> {
  for (const entry of entries) {
    await db
      .insert(staff)
      .values(entry)
      .onConflictDoUpdate({ target: staff.email, set: { name: sql`excluded.name`, role: sql`excluded.role` } });
  }
}

const FAKE_TEAMS = [
  { name: "Seed Team One", track: "Track A", size: 3 },
  { name: "Seed Team Two", track: "Track B", size: 4 },
  { name: "Seed Team Three", track: "Track C", size: 3 },
] as const;

// Returns how many teams it created; teams that already exist (by name key) are left alone.
export async function seedFakeTeams(db: Db): Promise<number> {
  let created = 0;
  for (const [i, fake] of FAKE_TEAMS.entries()) {
    const n = i + 1;
    const nameKey = teamNameKey(fake.name);
    const [existing] = await db.select({ id: teams.id }).from(teams).where(eq(teams.nameKey, nameKey)).limit(1);
    if (existing) continue;
    await db.transaction(async (tx) => {
      const [team] = await tx.insert(teams).values({ name: fake.name, nameKey, track: fake.track }).returning({ id: teams.id });
      await tx.insert(members).values(
        Array.from({ length: fake.size }, (_, j) => {
          const m = j + 1;
          const serial = String(n * 100 + m).padStart(6, "0");
          return {
            teamId: team!.id,
            position: m,
            isLeader: m === 1,
            firstName: "Seed",
            lastName: `Member ${n}.${m}`,
            regNumber: `RA2611026${serial}`,
            srmEmail: `seed.${n}.${m}@${SRM_EMAIL_DOMAIN}`,
            personalEmail: `seed.${n}.${m}@example.com`,
            phone: `98765${serial.slice(1)}`,
          };
        }),
      );
    });
    created++;
  }
  return created;
}
