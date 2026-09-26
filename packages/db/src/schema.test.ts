import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { members, teams } from "./schema";
import { createTestDb } from "./test-utils";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const member = (teamId: string, n: number) => ({
  teamId,
  position: n,
  isLeader: n === 1,
  firstName: `M${n}`,
  lastName: "Test",
  regNumber: `RA261102601069${n}`,
  srmEmail: `m${n}@srmist.edu.in`,
  personalEmail: `m${n}@gmail.com`,
  phone: `987654321${n}`,
});

describe("schema", () => {
  it("stores a team with its members and defaults", async () => {
    const [team] = await db.insert(teams).values({ name: "Null Pointers", nameKey: "null pointers", track: "Track A" }).returning();
    await db.insert(members).values([member(team!.id, 1), member(team!.id, 2), member(team!.id, 3)]);
    const rows = await db.select().from(members).where(eq(members.teamId, team!.id));
    expect(rows).toHaveLength(3);
    expect(team!.paymentStatus).toBe("not_required");
    expect(team!.shortlistStatus).toBe("pending");
  });

  it("rejects a second team with the same name key", async () => {
    await db.insert(teams).values({ name: "Null Pointers", nameKey: "null pointers", track: "Track A" });
    await expect(db.insert(teams).values({ name: "NULL pointers", nameKey: "null pointers", track: "Track B" })).rejects.toThrow();
  });

  it("rejects a registration number or SRM email already used by another member", async () => {
    const [a] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    const [b] = await db.insert(teams).values({ name: "B", nameKey: "b", track: "Track A" }).returning();
    await db.insert(members).values(member(a!.id, 1));
    await expect(db.insert(members).values({ ...member(b!.id, 1), srmEmail: "other@srmist.edu.in" })).rejects.toThrow();
    await expect(db.insert(members).values({ ...member(b!.id, 1), regNumber: "RA2611026010699" })).rejects.toThrow();
  });

  it("allows one leader per team", async () => {
    const [a] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    const [b] = await db.insert(teams).values({ name: "B", nameKey: "b", track: "Track A" }).returning();
    await db.insert(members).values([member(a!.id, 1), member(a!.id, 2)]);
    await expect(
      db.insert(members).values({ ...member(a!.id, 3), isLeader: true }),
    ).rejects.toThrow();
    await db.insert(members).values({ ...member(b!.id, 1), regNumber: "RA2611026010698", srmEmail: "b1@srmist.edu.in" });
    expect(await db.select().from(members)).toHaveLength(3);
  });

  it("deletes members with their team", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values(member(team!.id, 1));
    await db.delete(teams).where(eq(teams.id, team!.id));
    expect(await db.select().from(members)).toHaveLength(0);
  });
});
