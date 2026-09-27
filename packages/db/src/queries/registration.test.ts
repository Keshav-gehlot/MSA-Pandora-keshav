import { eq } from "drizzle-orm";
import type { Registration } from "@pandora/core";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { members, paymentProofs, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { issueOtp, verifyOtp } from "./auth";
import {
  findTakenMemberFields,
  isTeamNameAvailable,
  registerTeam,
} from "./registration";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

const TEAM_A = "11111111-1111-4111-8111-111111111111";
const TEAM_B = "22222222-2222-4222-8222-222222222222";

const member = (team: 1 | 2, n: number) => ({
  firstName: `M${n}`,
  lastName: "Test",
  regNumber: `RA26110260106${team}${n}`,
  srmEmail: `t${team}m${n}@srmist.edu.in`,
  personalEmail: `t${team}m${n}@gmail.com`,
  phone: `98765432${team}${n}`,
});

const reg = (
  teamName: string,
  team: 1 | 2,
  count = 3,
): Registration => ({
  teamName,
  track: "Track A",
  members: Array.from(
    { length: count },
    (_, i) => member(team, i + 1),
  ),
});

async function verify(email: string) {
  const issued = await issueOtp(db, {
    email,
    purpose: "registration",
  });

  if (!issued.ok) {
    throw new Error("could not issue");
  }

  expect(
    await verifyOtp(db, {
      email,
      purpose: "registration",
      code: issued.code,
    }),
  ).toEqual({ ok: true });
}

describe("registerTeam", () => {
  it("saves a verified team of three with the first member as leader", async () => {
    await verify("t1m1@srmist.edu.in");

    expect(
      await registerTeam(db, {
        teamId: TEAM_A,
        registration: reg("Null Pointers", 1),
        paymentEnabled: false,
      }),
    ).toEqual({ ok: true, teamId: TEAM_A });

    const [team] = await db.select().from(teams);

    expect(team).toMatchObject({
      id: TEAM_A,
      name: "Null Pointers",
      nameKey: "null pointers",
      track: "Track A",
      paymentStatus: "not_required",
      shortlistStatus: "pending",
    });

    const rows = await db
      .select()
      .from(members)
      .where(eq(members.teamId, TEAM_A))
      .orderBy(members.position);

    expect(
      rows.map((m) => [m.position, m.isLeader, m.srmEmail]),
    ).toEqual([
      [1, true, "t1m1@srmist.edu.in"],
      [2, false, "t1m2@srmist.edu.in"],
      [3, false, "t1m3@srmist.edu.in"],
    ]);
  });

  it("saves a team of four with photo paths", async () => {
    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1, 4),
      paymentEnabled: false,
      photoPaths: ["p/1.png", null, null, "p/4.jpg"],
    });

    const rows = await db
      .select()
      .from(members)
      .orderBy(members.position);

    expect(rows.map((m) => m.photoPath)).toEqual([
      "p/1.png",
      null,
      null,
      "p/4.jpg",
    ]);
  });

  it("refuses an unverified leader and saves nothing", async () => {
    expect(
      await registerTeam(db, {
        teamId: TEAM_A,
        registration: reg("Null Pointers", 1),
        paymentEnabled: false,
      }),
    ).toEqual({
      ok: false,
      reason: "email_not_verified",
    });

    expect(await db.select().from(teams)).toHaveLength(0);
  });

  it("reports a taken team name, saves nothing, and lets the leader resubmit without a new code", async () => {
    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1),
      paymentEnabled: false,
    });

    await verify("t2m1@srmist.edu.in");

    expect(
      await registerTeam(db, {
        teamId: TEAM_B,
        registration: reg("  NULL   pointers ", 2),
        paymentEnabled: false,
      }),
    ).toEqual({
      ok: false,
      reason: "taken",
      field: "teamName",
    });

    expect(await db.select().from(members)).toHaveLength(3);

    expect(
      await registerTeam(db, {
        teamId: TEAM_B,
        registration: reg("Segfaults", 2),
        paymentEnabled: false,
      }),
    ).toEqual({
      ok: true,
      teamId: TEAM_B,
    });
  });

  it("reports a registration number already used by another team", async () => {
    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1),
      paymentEnabled: false,
    });

    await verify("t2m1@srmist.edu.in");

    const clash = reg("Segfaults", 2);

    clash.members[1] = {
      ...clash.members[1]!,
      regNumber: "RA2611026010612",
    };

    expect(
      await registerTeam(db, {
        teamId: TEAM_B,
        registration: clash,
        paymentEnabled: false,
      }),
    ).toEqual({
      ok: false,
      reason: "taken",
      field: "regNumber",
    });
  });

  it("records a pending payment and its proof when payments are on", async () => {
    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1),
      paymentEnabled: true,
      paymentProofPath: `teams/${TEAM_A}/payment/x.png`,
    });

    const [team] = await db.select().from(teams);

    expect(team?.paymentStatus).toBe("pending");

    const proofs = await db.select().from(paymentProofs);

    expect(
      proofs.map((p) => [p.teamId, p.filePath, p.status]),
    ).toEqual([
      [
        TEAM_A,
        `teams/${TEAM_A}/payment/x.png`,
        "pending",
      ],
    ]);
  });
});

describe("availability checks", () => {
  it("reports whether a team name is free, ignoring case and spacing", async () => {
    expect(
      await isTeamNameAvailable(db, "Null Pointers"),
    ).toBe(true);

    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1),
      paymentEnabled: false,
    });

    expect(
      await isTeamNameAvailable(
        db,
        "  null   POINTERS ",
      ),
    ).toBe(false);
  });

  it("lists which member fields are already taken", async () => {
    await verify("t1m1@srmist.edu.in");

    await registerTeam(db, {
      teamId: TEAM_A,
      registration: reg("Null Pointers", 1),
      paymentEnabled: false,
    });

    expect(
      await findTakenMemberFields(db, [
        {
          regNumber: "RA2611026010612",
          srmEmail: "new1@srmist.edu.in",
        },
        {
          regNumber: "RA2611026010699",
          srmEmail: "t1m3@srmist.edu.in",
        },
        {
          regNumber: "RA2611026010698",
          srmEmail: "new2@srmist.edu.in",
        },
      ]),
    ).toEqual([
      { index: 0, field: "regNumber" },
      { index: 1, field: "srmEmail" },
    ]);
  });
});