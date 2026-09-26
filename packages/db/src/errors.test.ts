import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./client";
import { uniqueViolationField } from "./errors";
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

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the query to fail");
}

describe("uniqueViolationField", () => {
  it("maps a duplicate team name key to teamName", async () => {
    await db.insert(teams).values({ name: "Null Pointers", nameKey: "null pointers", track: "Track A" });
    const error = await caught(db.insert(teams).values({ name: "NULL pointers", nameKey: "null pointers", track: "Track B" }));
    expect(uniqueViolationField(error)).toBe("teamName");
  });

  it("maps a duplicate registration number to regNumber and a duplicate SRM email to srmEmail", async () => {
    const [a] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    const [b] = await db.insert(teams).values({ name: "B", nameKey: "b", track: "Track A" }).returning();
    await db.insert(members).values(member(a!.id, 1));
    const dupReg = await caught(db.insert(members).values({ ...member(b!.id, 1), srmEmail: "other@srmist.edu.in" }));
    expect(uniqueViolationField(dupReg)).toBe("regNumber");
    const dupEmail = await caught(db.insert(members).values({ ...member(b!.id, 1), regNumber: "RA2611026010699" }));
    expect(uniqueViolationField(dupEmail)).toBe("srmEmail");
  });

  it("returns null for other unique violations and for non-database errors", async () => {
    const [a] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values(member(a!.id, 1));
    const samePosition = await caught(db.insert(members).values({ ...member(a!.id, 2), position: 1 }));
    expect(uniqueViolationField(samePosition)).toBeNull();
    expect(uniqueViolationField(new Error("boom"))).toBeNull();
    expect(uniqueViolationField(null)).toBeNull();
    expect(uniqueViolationField("nope")).toBeNull();
  });

  it("reads the code and constraint from the error itself or its cause", () => {
    expect(uniqueViolationField({ code: "23505", constraint: "members_srm_email_unique" })).toBe("srmEmail");
    expect(uniqueViolationField({ cause: { code: "23505", constraint: "teams_name_key_unique" } })).toBe("teamName");
    expect(uniqueViolationField({ code: "23503", constraint: "members_reg_number_unique" })).toBeNull();
  });
});
