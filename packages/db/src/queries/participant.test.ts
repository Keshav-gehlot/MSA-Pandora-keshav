import type { TeamSnapshot } from "@pandora/core";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { editRequests, members, notifications, staff, submissions, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { getDashboard, getTeamSnapshot, markNotificationRead, proposeEdit, saveSubmission } from "./participant";

let db: Db;
let teamId: string, otherTeamId: string, memberId: string, staffId: string;

async function seedTeam(name: string, n: number) {
  const [t] = await db.insert(teams).values({
    name,
    nameKey: name.toLowerCase(),
    track: "Track A",
  }).returning();

  const rows = await db.insert(members).values(
    [1, 2, 3].map((p) => ({
      teamId: t!.id,
      position: p,
      isLeader: p === 1,
      firstName: `M${p}`,
      lastName: "T",
      regNumber: `RA26110260106${n}${p}`,
      srmEmail: `t${n}m${p}@srmist.edu.in`,
      personalEmail: `t${n}m${p}@gmail.com`,
      phone: `98765432${n}${p}`,
    })),
  ).returning();

  return {
    teamId: t!.id,
    memberIds: rows.sort((a, b) => a.position - b.position).map((r) => r.id),
  };
}

beforeEach(async () => {
  db = await createTestDb();

  const a = await seedTeam("Null Pointers", 1);
  const b = await seedTeam("Segfaults", 2);

  teamId = a.teamId;
  memberId = a.memberIds[0]!;
  otherTeamId = b.teamId;

  const [s] = await db.insert(staff).values({
    email: "admin@srmist.edu.in",
    name: "Admin",
    role: "admin",
  }).returning();

  staffId = s!.id;
});

describe("getTeamSnapshot", () => {
  it("returns team and members in position order", async () => {
    const snap = await getTeamSnapshot(db, teamId);

    expect(snap?.teamName).toBe("Null Pointers");
    expect(snap?.members.map((m) => m.srmEmail)).toEqual([
      "t1m1@srmist.edu.in",
      "t1m2@srmist.edu.in",
      "t1m3@srmist.edu.in",
    ]);

    expect(
      await getTeamSnapshot(db, "00000000-0000-4000-8000-00000000dead"),
    ).toBeNull();
  });
});

describe("notifications", () => {
  it("shows team and global notices newest first", async () => {
    await db.insert(notifications).values([
      {
        teamId: null,
        title: "Welcome",
        body: "Hi all",
        createdBy: staffId,
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        teamId,
        title: "Yours",
        body: "Just you",
        createdBy: staffId,
        createdAt: new Date("2026-10-02T10:00:00Z"),
      },
      {
        teamId: otherTeamId,
        title: "Theirs",
        body: "Not you",
        createdBy: staffId,
        createdAt: new Date("2026-10-03T10:00:00Z"),
      },
    ]);

    let d = await getDashboard(db, { teamId, memberId });

    expect(d.notifications.map((n) => [n.title, n.read])).toEqual([
      ["Yours", false],
      ["Welcome", false],
    ]);
    expect(d.unreadCount).toBe(2);

    await markNotificationRead(db, {
      notificationId: d.notifications[0]!.id,
      memberId,
      teamId,
    });
    // Marking the same notice read again is a no-op (idempotent), not an error or a double effect.
    await markNotificationRead(db, {
      notificationId: d.notifications[0]!.id,
      memberId,
      teamId,
    });

    d = await getDashboard(db, { teamId, memberId });
    expect(d.unreadCount).toBe(1);
  });

  it("ignores another team's notification", async () => {
    const [theirs] = await db.insert(notifications).values({
      teamId: otherTeamId,
      title: "Theirs",
      body: "x",
      createdBy: staffId,
    }).returning();

    await markNotificationRead(db, {
      notificationId: theirs!.id,
      memberId,
      teamId,
    });

    expect(await db.select().from(notifications)).toHaveLength(1);
  });
});

describe("proposeEdit", () => {
  it("stores changed fields", async () => {
    const current = (await getTeamSnapshot(db, teamId))!;
    const proposed: TeamSnapshot = structuredClone(current);

    proposed.members[1]!.phone = "9000000000";

    const r = await proposeEdit(db, {
      teamId,
      memberId,
      proposed,
    });

    expect(r).toEqual({
      ok: true,
      changes: [{
        path: `members.${current.members[1]!.id}.phone`,
        from: current.members[1]!.phone,
        to: "9000000000",
      }],
    });

    expect(
      (await getDashboard(db, { teamId, memberId })).pendingEdit?.changes,
    ).toHaveLength(1);
  });

  it("refuses no changes and duplicate pending request", async () => {
    const current = (await getTeamSnapshot(db, teamId))!;

    expect(await proposeEdit(db, {
      teamId,
      memberId,
      proposed: current,
    })).toEqual({ ok: false, reason: "no_changes" });

    await proposeEdit(db, {
      teamId,
      memberId,
      proposed: { ...current, teamName: "Renamed" },
    });

    expect(await proposeEdit(db, {
      teamId,
      memberId,
      proposed: { ...current, track: "Track C" },
    })).toEqual({ ok: false, reason: "pending_exists" });

    expect(await db.select().from(editRequests)).toHaveLength(1);
  });
});

describe("saveSubmission", () => {
  const sub = {
    repoUrl: "https://github.com/a/b",
    demoUrl: null,
    notes: "v1",
  };

  it("creates and updates Episode 0 submission", async () => {
    await saveSubmission(db, { teamId, submission: sub });

    await saveSubmission(db, {
      teamId,
      submission: { ...sub, notes: "v2" },
    });

    const rows = await db.select().from(submissions);

    expect(rows.map((r) => [r.teamId, r.episode, r.notes]))
      .toEqual([[teamId, 0, "v2"]]);
    // The dashboard shows the updated submission, not just the raw table row.
    expect((await getDashboard(db, { teamId, memberId })).submission?.notes).toBe("v2");
  });

  it("refuses after deadline", async () => {
    expect(await saveSubmission(db, {
      teamId,
      submission: sub,
      now: new Date("2026-10-20T00:00:00Z"),
      deadline: "2026-10-15T23:59:00+05:30",
    })).toEqual({ ok: false, reason: "closed" });
  });

  it.each(["pending", "declined"] as const)("refuses a team whose payment is %s, and stores nothing", async (status) => {
    await db.update(teams).set({ paymentStatus: status }).where(eq(teams.id, teamId));

    expect(await saveSubmission(db, { teamId, submission: sub })).toEqual({ ok: false, reason: "not_verified" });
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it.each(["approved", "not_required"] as const)("accepts a verified team (payment %s)", async (status) => {
    await db.update(teams).set({ paymentStatus: status }).where(eq(teams.id, teamId));

    expect(await saveSubmission(db, { teamId, submission: sub })).toEqual({ ok: true });
    expect(await db.select().from(submissions)).toHaveLength(1);
  });

  it("refuses an unknown team", async () => {
    expect(await saveSubmission(db, { teamId: "00000000-0000-0000-0000-000000000000", submission: sub })).toEqual({
      ok: false,
      reason: "not_verified",
    });
  });
});
