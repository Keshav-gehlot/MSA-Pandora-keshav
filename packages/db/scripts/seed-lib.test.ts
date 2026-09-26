import { registrationSchema } from "@pandora/core";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/client";
import { members, staff, teams } from "../src/schema";
import { createTestDb } from "../src/test-utils";
import { parseSeedStaff, seedFakeTeams, seedRefusal, seedStaff } from "./seed-lib";

describe("seedRefusal", () => {
  it("allows a dev database", () => {
    expect(seedRefusal({ url: "postgres://u:p@ep-cool-1.ap-southeast-1.aws.neon.tech/pandora", vercelEnv: undefined })).toBeNull();
    expect(seedRefusal({ url: "postgres://u:p@localhost:5432/pandora", vercelEnv: "development" })).toBeNull();
  });
  it("refuses Supabase hosts", () => {
    expect(seedRefusal({ url: "postgres://u:p@aws-0-ap-south-1.pooler.supabase.com:5432/postgres", vercelEnv: undefined })).toMatch(/supabase/i);
    expect(seedRefusal({ url: "postgres://u:p@db.abcd.supabase.co:5432/postgres", vercelEnv: undefined })).toMatch(/supabase/i);
  });
  it("refuses production", () => {
    expect(seedRefusal({ url: "postgres://u:p@localhost/pandora", vercelEnv: "production" })).toMatch(/production/i);
  });
  it("refuses a missing or unreadable URL", () => {
    expect(seedRefusal({ url: undefined, vercelEnv: undefined })).toMatch(/DATABASE_URL/);
    expect(seedRefusal({ url: "not a url", vercelEnv: undefined })).toMatch(/URL/);
  });
  it("never echoes the URL", () => {
    const url = "postgres://user:secret@x.pooler.supabase.com/postgres";
    expect(seedRefusal({ url, vercelEnv: undefined })).not.toContain("secret");
    expect(seedRefusal({ url: "garbage-secret", vercelEnv: undefined })).not.toContain("secret");
  });
});

describe("parseSeedStaff", () => {
  it("parses email:Name:role entries and lower-cases emails", () => {
    expect(parseSeedStaff(" Ojas@SRMIST.edu.in:Ojas Mutreja:admin ; v@srmist.edu.in:Volunteer One:staff;")).toEqual([
      { email: "ojas@srmist.edu.in", name: "Ojas Mutreja", role: "admin" },
      { email: "v@srmist.edu.in", name: "Volunteer One", role: "staff" },
    ]);
  });
  it("returns nothing for an empty value", () => {
    expect(parseSeedStaff(undefined)).toEqual([]);
    expect(parseSeedStaff("  ")).toEqual([]);
  });
  it("rejects malformed entries and unknown roles", () => {
    expect(() => parseSeedStaff("a@srmist.edu.in:A")).toThrow(/email:Name:role/);
    expect(() => parseSeedStaff("a@srmist.edu.in:A:owner")).toThrow(/admin or staff/);
    expect(() => parseSeedStaff("not-an-email:A:staff")).toThrow(/email/);
  });
});

describe("seeding", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("upserts staff on email", async () => {
    await seedStaff(db, [{ email: "a@srmist.edu.in", name: "A", role: "staff" }]);
    await seedStaff(db, [{ email: "a@srmist.edu.in", name: "A Renamed", role: "admin" }, { email: "b@srmist.edu.in", name: "B", role: "staff" }]);
    const rows = await db.select().from(staff).orderBy(asc(staff.email));
    expect(rows.map((r) => [r.email, r.name, r.role])).toEqual([
      ["a@srmist.edu.in", "A Renamed", "admin"],
      ["b@srmist.edu.in", "B", "staff"],
    ]);
  });

  it("creates three valid fake teams once", async () => {
    expect(await seedFakeTeams(db)).toBe(3);
    expect(await seedFakeTeams(db)).toBe(0);
    const allTeams = await db.select().from(teams).orderBy(asc(teams.name));
    expect(allTeams.map((t) => [t.name, t.track])).toEqual([
      ["Seed Team One", "Track A"],
      ["Seed Team Three", "Track C"],
      ["Seed Team Two", "Track B"],
    ]);
    for (const team of allTeams) {
      const rows = await db.select().from(members).where(eq(members.teamId, team.id)).orderBy(asc(members.position));
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(rows.length).toBeLessThanOrEqual(4);
      expect(rows.filter((m) => m.isLeader)).toHaveLength(1);
      for (const m of rows) expect(m.srmEmail).toMatch(/^seed\.\d\.\d@srmist\.edu\.in$/);
      const parsed = registrationSchema.safeParse({ teamName: team.name, track: team.track, members: rows });
      expect(parsed.success).toBe(true);
    }
  });
});
