import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { adminActions, members, paymentProofs, staff, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { decidePayment, listPendingPayments, recordAdminAction } from "./admin-review";

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
    .values({ name: "Alpha", nameKey: "alpha", track: "Track A", paymentStatus: "pending" })
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
    const r = await decidePayment(db, { proofId, staffId, decision: "approved" });
    expect(r).toEqual({
      ok: true,
      teamName: "Alpha",
      memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in", "t1m3@srmist.edu.in"],
    });
    expect((await db.select().from(teams))[0]?.paymentStatus).toBe("approved");
    expect((await db.select().from(adminActions)).map((a) => [a.action, a.targetId])).toEqual([
      ["payment.approved", proofId],
    ]);
    expect(await decidePayment(db, { proofId, staffId, decision: "declined" })).toEqual({
      ok: false,
      reason: "already_decided",
    });
  });

  it("declines with a note", async () => {
    await decidePayment(db, { proofId, staffId, decision: "declined", note: "Blurry screenshot" });
    expect((await db.select().from(paymentProofs))[0]).toMatchObject({
      status: "declined",
      note: "Blurry screenshot",
      reviewedBy: staffId,
    });
    expect((await db.select().from(teams))[0]?.paymentStatus).toBe("declined");
  });

  it("lets only one of two concurrent decisions win", async () => {
    const results = await Promise.all([
      decidePayment(db, { proofId, staffId, decision: "approved" }),
      decidePayment(db, { proofId, staffId, decision: "declined" }),
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
      .values({ name: "Beta", nameKey: "beta", track: "Track B", paymentStatus: "pending" })
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
    expect(pending[0]).toMatchObject({ proofId, teamName: "Alpha" });
    expect(pending[1]).toMatchObject({ proofId: p2!.id, teamName: "Beta" });

    // After deciding Alpha, only Beta should remain in the pending queue
    await decidePayment(db, { proofId, staffId, decision: "approved" });
    const remaining = await listPendingPayments(db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ proofId: p2!.id, teamName: "Beta" });
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
