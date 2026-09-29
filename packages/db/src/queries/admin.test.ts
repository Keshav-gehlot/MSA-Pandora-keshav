import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { members, submissions, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { exportTeamsCsv, getOverview, getTeamDetail, listTeams } from "./admin";

let db: Db;

async function seedTeam(name: string, track: string, n: number, size = 3) {
  const [team] = await db.insert(teams).values({ name, nameKey: name.toLowerCase(), track }).returning();
  if (!team) throw new Error("Could not seed team");

  await db.insert(members).values(
    Array.from({ length: size }, (_, index) => ({
      teamId: team.id,
      position: index + 1,
      isLeader: index === 0,
      firstName: `F${n}${index + 1}`,
      lastName: "L",
      regNumber: `RA26110260106${n}${index + 1}`,
      srmEmail: `t${n}m${index + 1}@srmist.edu.in`,
      personalEmail: `t${n}m${index + 1}@gmail.com`,
      phone: `98765432${n}${index + 1}`,
    })),
  );

  return team;
}

beforeEach(async () => {
  db = await createTestDb();
});

describe("admin read queries", () => {
  it("counts teams, members and tracks", async () => {
    const alpha = await seedTeam("Alpha", "Track A", 1);
    await seedTeam("Beta", "Track B", 2, 4);
    await db.insert(submissions).values({ teamId: alpha.id, repoUrl: "https://github.com/a/b" });

    expect(await getOverview(db)).toEqual({
      teams: 2,
      members: 7,
      byTrack: { "Track A": 1, "Track B": 1 },
      paymentPending: 0,
      editRequestsPending: 0,
      submissions: 1,
      shortlisted: 0,
    });
  });

  it("searches by team, member name, registration number and email", async () => {
    await seedTeam("Alpha", "Track A", 1);
    await seedTeam("Beta", "Track B", 2);

    expect((await listTeams(db, { search: "alp" })).map((team) => team.name)).toEqual(["Alpha"]);
    expect(await listTeams(db, { search: "F22" })).toMatchObject([
      { name: "Beta", memberCount: 3, leaderName: "F21 L" },
    ]);
    expect((await listTeams(db, { search: "RA2611026010613" })).map((team) => team.name)).toEqual(["Alpha"]);
    expect((await listTeams(db, { search: "T2M3@SRMIST" })).map((team) => team.name)).toEqual(["Beta"]);
    expect((await listTeams(db, { track: "Track B" }))[0]).toMatchObject({
      name: "Beta",
      memberCount: 3,
      leaderName: "F21 L",
    });
  });

  it("returns a team's full detail", async () => {
    const alpha = await seedTeam("Alpha", "Track A", 1);
    const detail = await getTeamDetail(db, alpha.id);

    expect(detail?.members.map((member) => member.position)).toEqual([1, 2, 3]);
    expect(detail?.submission).toBeNull();
  });

  it("exports one CSV row per member", async () => {
    await seedTeam("Beta", "Track B", 2);
    await seedTeam("Alpha", "Track A", 1);

    const lines = (await exportTeamsCsv(db)).trim().split("\n");

    expect(lines[0]).toBe("team_name,track,payment_status,shortlist_status,position,is_leader,first_name,last_name,reg_number,srm_email,personal_email,phone");
    expect(lines).toHaveLength(7);
    expect(lines[1]).toBe("Alpha,Track A,not_required,pending,1,true,F11,L,RA2611026010611,t1m1@srmist.edu.in,t1m1@gmail.com,9876543211");
  });
});
