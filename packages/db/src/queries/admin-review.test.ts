import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Db } from "../client";
import {
  adminActions,
  members,
  notifications,
  paymentProofs,
  staff,
  submissions,
  teams,
} from "../schema";
import { createTestDb } from "../test-utils";
import {
  createNotification,
  decidePayment,
  listNotifications,
  listNoticeTeams,
  listPendingPayments,
  listSubmissions,
  recordAdminAction,
  reviewSubmission,
  setShortlistStatus,
} from "./admin-review";

let db: Db;
let staffId: string;
let proofId: string;
let teamId: string;

beforeEach(async () => {
  db = await createTestDb();

  const [s] = await db
    .insert(staff)
    .values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" })
    .returning();
  staffId = s!.id;

  const [t] = await db
    .insert(teams)
    .values({
      name: "Alpha",
      nameKey: "alpha",
      track: "Track A",
      paymentStatus: "pending",
    })
    .returning();
  teamId = t!.id;

  await db.insert(members).values([
    {
      teamId,
      position: 1,
      isLeader: true,
      firstName: "M1",
      lastName: "L",
      regNumber: "RA2611026010611",
      srmEmail: "t1m1@srmist.edu.in",
      personalEmail: "t1m1@gmail.com",
      phone: "9876543211",
    },
    {
      teamId,
      position: 2,
      isLeader: false,
      firstName: "M2",
      lastName: "L",
      regNumber: "RA2611026010612",
      srmEmail: "t1m2@srmist.edu.in",
      personalEmail: "t1m2@gmail.com",
      phone: "9876543212",
    },
    {
      teamId,
      position: 3,
      isLeader: false,
      firstName: "M3",
      lastName: "L",
      regNumber: "RA2611026010613",
      srmEmail: "t1m3@srmist.edu.in",
      personalEmail: "t1m3@gmail.com",
      phone: "9876543213",
    },
  ]);

  const [p] = await db
    .insert(paymentProofs)
    .values({
      teamId,
      filePath: "proofs/alpha.png",
      status: "pending",
    })
    .returning();
  proofId = p!.id;
});

describe("admin payment review queries", () => {
  it("approves a pending payment once, updates the team and records it", async () => {
    const r = await decidePayment(db, {
      proofId,
      staffId,
      decision: "approved",
    });

    expect(r).toEqual({
      ok: true,
      teamName: "Alpha",
      memberEmails: [
        "t1m1@srmist.edu.in",
        "t1m2@srmist.edu.in",
        "t1m3@srmist.edu.in",
      ],
    });

    expect((await db.select().from(teams))[0]?.paymentStatus).toBe(
      "approved",
    );
    expect(
      (await db.select().from(adminActions)).map((a) => [
        a.action,
        a.targetId,
      ]),
    ).toEqual([["payment.approved", proofId]]);

    expect(
      await decidePayment(db, {
        proofId,
        staffId,
        decision: "declined",
      }),
    ).toEqual({
      ok: false,
      reason: "already_decided",
    });
  });

  it("declines with a note", async () => {
    await decidePayment(db, {
      proofId,
      staffId,
      decision: "declined",
      note: "Blurry screenshot",
    });

    expect((await db.select().from(paymentProofs))[0]).toMatchObject({
      status: "declined",
      note: "Blurry screenshot",
      reviewedBy: staffId,
    });

    expect((await db.select().from(teams))[0]?.paymentStatus).toBe(
      "declined",
    );
  });

  it("lets only one of two concurrent decisions win", async () => {
    const results = await Promise.all([
      decidePayment(db, {
        proofId,
        staffId,
        decision: "approved",
      }),
      decidePayment(db, {
        proofId,
        staffId,
        decision: "declined",
      }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("reports an unknown proof", async () => {
    expect(
      await decidePayment(db, {
        proofId: "00000000-0000-4000-8000-00000000dead",
        staffId,
        decision: "approved",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("lists pending payments oldest first", async () => {
    const [t2] = await db
      .insert(teams)
      .values({
        name: "Beta",
        nameKey: "beta",
        track: "Track B",
        paymentStatus: "pending",
      })
      .returning();

    const [p2] = await db
      .insert(paymentProofs)
      .values({
        teamId: t2!.id,
        filePath: "proofs/beta.png",
        status: "pending",
        createdAt: new Date(Date.now() + 10000),
      })
      .returning();

    const pending = await listPendingPayments(db);
    expect(pending).toHaveLength(2);
    expect(pending[0]).toMatchObject({
      proofId,
      teamName: "Alpha",
    });
    expect(pending[1]).toMatchObject({
      proofId: p2!.id,
      teamName: "Beta",
    });

    // After deciding Alpha, only Beta should remain in the pending queue
    await decidePayment(db, {
      proofId,
      staffId,
      decision: "approved",
    });

    const remaining = await listPendingPayments(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({
      proofId: p2!.id,
      teamName: "Beta",
    });
  });

  it("records arbitrary admin actions directly", async () => {
    await recordAdminAction(db, {
      staffId,
      action: "test.action",
      targetType: "test",
      targetId: "target-123",
      detail: { reason: "testing" },
    });

    const actions = await db.select().from(adminActions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      staffId,
      action: "test.action",
      targetType: "test",
      targetId: "target-123",
      detail: { reason: "testing" },
    });
  });
});

describe("admin Episode 0 review and shortlisting queries", () => {
  it("lists submissions ordered with highest score first and unscored last", async () => {
    // teamId (Alpha) has a submission with score 80
    const [s1] = await db
      .insert(submissions)
      .values({
        teamId,
        episode: 0,
        repoUrl: "https://github.com/alpha/repo",
        demoUrl: "https://alpha.demo.com",
        notes: "Alpha submission",
        score: 80,
        reviewNote: "Good start",
        updatedAt: new Date("2026-10-01T10:00:00Z"),
      })
      .returning();

    // Create Team Beta (score 95)
    const [tBeta] = await db
      .insert(teams)
      .values({
        name: "Beta",
        nameKey: "beta",
        track: "Track B",
      })
      .returning();

    const [sBeta] = await db
      .insert(submissions)
      .values({
        teamId: tBeta!.id,
        episode: 0,
        repoUrl: "https://github.com/beta/repo",
        demoUrl: null,
        notes: "Beta submission",
        score: 95,
        reviewNote: "Outstanding work",
        updatedAt: new Date("2026-10-01T11:00:00Z"),
      })
      .returning();

    // Create Team Gamma (unscored: null)
    const [tGamma] = await db
      .insert(teams)
      .values({
        name: "Gamma",
        nameKey: "gamma",
        track: "Track A",
      })
      .returning();

    const [sGamma] = await db
      .insert(submissions)
      .values({
        teamId: tGamma!.id,
        episode: 0,
        repoUrl: "https://github.com/gamma/repo",
        demoUrl: null,
        notes: null,
        score: null,
        reviewNote: null,
        updatedAt: new Date("2026-10-01T12:00:00Z"),
      })
      .returning();

    // Create Team Delta (score 65)
    const [tDelta] = await db
      .insert(teams)
      .values({
        name: "Delta",
        nameKey: "delta",
        track: "Track C",
      })
      .returning();

    const [sDelta] = await db
      .insert(submissions)
      .values({
        teamId: tDelta!.id,
        episode: 0,
        repoUrl: "https://github.com/delta/repo",
        demoUrl: "https://delta.demo.com",
        notes: "Delta submission",
        score: 65,
        reviewNote: "Needs improvement",
        updatedAt: new Date("2026-10-01T09:00:00Z"),
      })
      .returning();

    // Insert an episode 1 submission that should NOT be in episode 0 results
    await db.insert(submissions).values({
      teamId: tBeta!.id,
      episode: 1,
      repoUrl: "https://github.com/beta/ep1",
      score: 100,
    });

    const list = await listSubmissions(db);
    expect(list).toHaveLength(4);

    // Verify ordering: 95 (Beta), 80 (Alpha), 65 (Delta), unscored null (Gamma)
    expect(list[0]).toMatchObject({
      submissionId: sBeta!.id,
      teamName: "Beta",
      track: "Track B",
      score: 95,
      shortlistStatus: "pending",
    });

    expect(list[1]).toMatchObject({
      submissionId: s1!.id,
      teamName: "Alpha",
      track: "Track A",
      score: 80,
    });

    expect(list[2]).toMatchObject({
      submissionId: sDelta!.id,
      teamName: "Delta",
      track: "Track C",
      score: 65,
    });

    expect(list[3]).toMatchObject({
      submissionId: sGamma!.id,
      teamName: "Gamma",
      track: "Track A",
      score: null,
    });
  });

  it("stores submission review and records audit action", async () => {
    const [sub] = await db
      .insert(submissions)
      .values({
        teamId,
        episode: 0,
        repoUrl: "https://github.com/alpha/repo",
        notes: "Initial project note",
      })
      .returning();

    const res = await reviewSubmission(db, {
      submissionId: sub!.id,
      staffId,
      score: 90,
      reviewNote: "Excellent architecture and test coverage",
    });

    expect(res).toEqual({ ok: true });

    const [updated] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, sub!.id));

    expect(updated?.score).toBe(90);
    expect(updated?.reviewNote).toBe(
      "Excellent architecture and test coverage",
    );

    const actions = await db.select().from(adminActions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      staffId,
      action: "submission.reviewed",
      targetType: "submission",
      targetId: sub!.id,
      detail: {
        score: 90,
        reviewNote: "Excellent architecture and test coverage",
      },
    });
  });

  it("returns ok: false when reviewing unknown submission", async () => {
    const res = await reviewSubmission(db, {
      submissionId: "00000000-0000-4000-8000-00000000dead",
      staffId,
      score: 80,
      reviewNote: "Does not exist",
    });

    expect(res).toEqual({ ok: false });
  });

  it("updates shortlist status and records audit action", async () => {
    const res = await setShortlistStatus(db, {
      teamId,
      staffId,
      status: "shortlisted",
    });

    expect(res).toEqual({ ok: true });

    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    expect(team?.shortlistStatus).toBe("shortlisted");

    const actions = await db.select().from(adminActions);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      staffId,
      action: "team.shortlist",
      targetType: "team",
      targetId: teamId,
      detail: {
        from: "pending",
        to: "shortlisted",
      },
    });

    // Can transition to not_shortlisted
    const res2 = await setShortlistStatus(db, {
      teamId,
      staffId,
      status: "not_shortlisted",
    });

    expect(res2).toEqual({ ok: true });

    const [teamAfter] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, teamId));

    expect(teamAfter?.shortlistStatus).toBe("not_shortlisted");

    const actionsAfter = await db.select().from(adminActions);
    expect(actionsAfter).toHaveLength(2);
    expect(actionsAfter[1]).toMatchObject({
      action: "team.shortlist",
      targetId: teamId,
      detail: {
        from: "shortlisted",
        to: "not_shortlisted",
      },
    });
  });

  it("returns not_found when setting shortlist status for unknown team", async () => {
    const res = await setShortlistStatus(db, {
      teamId: "00000000-0000-4000-8000-00000000dead",
      staffId,
      status: "shortlisted",
    });

    expect(res).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("admin notification queries", () => {
  it("stores all-team and single-team notices with audit records", async () => {
    const allTeams = await createNotification(db, {
      staffId,
      teamId: null,
      title: "Episode 0 is live",
      body: "Submit your project by Friday.",
    });

    const singleTeam = await createNotification(db, {
      staffId,
      teamId,
      title: "Alpha update",
      body: "Please update your repository link.",
    });

    expect(await db.select().from(notifications)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: allTeams.id,
          teamId: null,
          title: "Episode 0 is live",
          body: "Submit your project by Friday.",
          createdBy: staffId,
        }),
        expect.objectContaining({
          id: singleTeam.id,
          teamId,
          title: "Alpha update",
          body: "Please update your repository link.",
          createdBy: staffId,
        }),
      ]),
    );

    expect(
      (await db.select().from(adminActions)).filter(
        (action) => action.action === "notification.created",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          staffId,
          targetType: "notification",
          targetId: allTeams.id,
          detail: { teamId: null },
        }),
        expect.objectContaining({
          staffId,
          targetType: "notification",
          targetId: singleTeam.id,
          detail: { teamId },
        }),
      ]),
    );
  });

  it("lists sent notices newest first with their target team", async () => {
    await db.insert(notifications).values([
      {
        teamId,
        title: "Older team notice",
        body: "For Alpha only.",
        createdBy: staffId,
        createdAt: new Date("2026-09-20T09:00:00.000Z"),
      },
      {
        teamId: null,
        title: "Newer all-team notice",
        body: "For everyone.",
        createdBy: staffId,
        createdAt: new Date("2026-09-21T09:00:00.000Z"),
      },
    ]);

    await expect(listNotifications(db)).resolves.toMatchObject([
      {
        title: "Newer all-team notice",
        teamId: null,
        teamName: null,
      },
      {
        title: "Older team notice",
        teamId,
        teamName: "Alpha",
      },
    ]);
  });

  it("lists teams for the notice target picker", async () => {
    await db
      .insert(teams)
      .values({ name: "Beta", nameKey: "beta", track: "Track B" });

    await expect(listNoticeTeams(db)).resolves.toEqual([
      { id: teamId, name: "Alpha" },
      expect.objectContaining({ name: "Beta" }),
    ]);
  });
});