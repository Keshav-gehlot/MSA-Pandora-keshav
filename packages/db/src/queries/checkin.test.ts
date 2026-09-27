import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { attendance, checkinPasses, members, staff, teams } from "../schema";
import { createTestDb } from "../test-utils";
import {
  CHECKIN_EVENT,
  attendanceSummary,
  checkIn,
  getPassToken,
  issuePassesForTeam,
  lookupPass,
  revokePass,
  searchCheckin,
} from "./checkin";

let db: Db;

const SECRET = "test-secret-at-least-32-bytes-long!!";
const OTHER_SECRET = "another-secret-that-is-at-least-32-bytes!!";

let alphaTeamId: string;
let betaTeamId: string;
let alphaMemberIds: string[];
let betaMemberIds: string[];
let staffId: string;

beforeEach(async () => {
  db = await createTestDb();

  // Seed Staff
  const [s] = await db
    .insert(staff)
    .values({
      email: "gate1@srmist.edu.in",
      name: "Gate One",
      role: "staff",
    })
    .returning();
  staffId = s!.id;

  // Seed Team Alpha (shortlisted, 3 members)
  const [alpha] = await db
    .insert(teams)
    .values({
      name: "Alpha",
      nameKey: "alpha",
      track: "Track A",
      shortlistStatus: "shortlisted",
    })
    .returning();
  alphaTeamId = alpha!.id;

  const alphaRows = await db
    .insert(members)
    .values([
      {
        teamId: alphaTeamId,
        position: 1,
        isLeader: true,
        firstName: "Alice",
        lastName: "Alpha",
        regNumber: "RA2611026010001",
        srmEmail: "alice@srmist.edu.in",
        personalEmail: "alice@example.com",
        phone: "9876543210",
        photoPath: "photos/alice.jpg",
      },
      {
        teamId: alphaTeamId,
        position: 2,
        isLeader: false,
        firstName: "Bob",
        lastName: "Alpha",
        regNumber: "RA2611026010002",
        srmEmail: "bob@srmist.edu.in",
        personalEmail: "bob@example.com",
        phone: "9876543211",
      },
      {
        teamId: alphaTeamId,
        position: 3,
        isLeader: false,
        firstName: "Charlie",
        lastName: "Alpha",
        regNumber: "RA2611026010003",
        srmEmail: "charlie@srmist.edu.in",
        personalEmail: "charlie@example.com",
        phone: "9876543212",
      },
    ])
    .returning();
  alphaMemberIds = alphaRows.map((r) => r.id);

  // Seed Team Beta (pending shortlist, 2 members)
  const [beta] = await db
    .insert(teams)
    .values({
      name: "Beta",
      nameKey: "beta",
      track: "Track B",
      shortlistStatus: "pending",
    })
    .returning();
  betaTeamId = beta!.id;

  const betaRows = await db
    .insert(members)
    .values([
      {
        teamId: betaTeamId,
        position: 1,
        isLeader: true,
        firstName: "David",
        lastName: "Beta",
        regNumber: "RA2611026010004",
        srmEmail: "david@srmist.edu.in",
        personalEmail: "david@example.com",
        phone: "9876543213",
      },
      {
        teamId: betaTeamId,
        position: 2,
        isLeader: false,
        firstName: "Eve",
        lastName: "Beta",
        regNumber: "RA2611026010005",
        srmEmail: "eve@srmist.edu.in",
        personalEmail: "eve@example.com",
        phone: "9876543214",
      },
    ])
    .returning();
  betaMemberIds = betaRows.map((r) => r.id);
});

describe("CHECKIN_EVENT constant", () => {
  it("equals episode_1", () => {
    expect(CHECKIN_EVENT).toBe("episode_1");
  });
});

describe("issuePassesForTeam", () => {
  it("issues one pass per member of a shortlisted team idempotently", async () => {
    const firstCall = await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    expect(firstCall).toEqual({ ok: true, issued: 3 });

    const secondCall = await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    expect(secondCall).toEqual({ ok: true, issued: 0 });

    const passes = await db.select().from(checkinPasses);
    expect(passes).toHaveLength(3);
  });

  it("refuses to issue passes for a non-shortlisted team", async () => {
    const result = await issuePassesForTeam(db, { teamId: betaTeamId, secret: SECRET });
    expect(result).toEqual({ ok: false, reason: "not_shortlisted" });

    const passes = await db.select().from(checkinPasses);
    expect(passes).toHaveLength(0);
  });

  it("refuses unknown team id", async () => {
    const result = await issuePassesForTeam(db, {
      teamId: "00000000-0000-4000-8000-000000000099",
      secret: SECRET,
    });
    expect(result).toEqual({ ok: false, reason: "not_shortlisted" });
  });

  it("does not attempt to re-issue or duplicate a pass for a member with a revoked pass", async () => {
    const firstCall = await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    expect(firstCall).toEqual({ ok: true, issued: 3 });

    await revokePass(db, alphaMemberIds[0]!);

    const secondCall = await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    expect(secondCall).toEqual({ ok: true, issued: 0 });

    const memberPasses = await db
      .select()
      .from(checkinPasses)
      .where(eq(checkinPasses.memberId, alphaMemberIds[0]!));
    expect(memberPasses).toHaveLength(1);
    expect(memberPasses[0]!.revokedAt).not.toBeNull();
  });

  it("enforces the database UNIQUE(member_id) constraint on checkin_passes", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    // Attempting a direct insert of a second pass for the same member violates the unique constraint
    await expect(
      db.insert(checkinPasses).values({
        id: "00000000-0000-4000-8000-000000000001",
        memberId: alphaMemberIds[0]!,
        tokenHash: "somehash",
      }),
    ).rejects.toThrow();
  });

  it("handles concurrent issuePassesForTeam calls idempotently without violating constraints", async () => {
    const results = await Promise.all([
      issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET }),
      issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET }),
    ]);
    const totalIssued = results.reduce((acc, r) => acc + (r.ok ? r.issued : 0), 0);
    expect(totalIssued).toBe(3);
    const passes = await db.select().from(checkinPasses);
    expect(passes).toHaveLength(3);
  });
});


describe("getPassToken & lookupPass", () => {
  it("recomputes the same 43-character token and finds the member by it", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });

    const token = await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const token2 = await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET });
    expect(token2).toBe(token);

    const resolved = await lookupPass(db, token!);
    expect(resolved).toEqual({
      memberId: alphaMemberIds[0]!,
      memberName: "Alice Alpha",
      regNumber: "RA2611026010001",
      photoPath: "photos/alice.jpg",
      teamName: "Alpha",
      track: "Track A",
      revoked: false,
      checkedIn: null,
    });
  });

  it("fails to resolve a token produced with a different secret", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });

    const forgedToken = await getPassToken(db, {
      memberId: alphaMemberIds[0]!,
      secret: OTHER_SECRET,
    });
    expect(forgedToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const resolved = await lookupPass(db, forgedToken!);
    expect(resolved).toBeNull();
  });

  it("returns null for unknown token", async () => {
    expect(await lookupPass(db, "x".repeat(43))).toBeNull();
  });

  it("returns null for non-shortlisted member", async () => {
    const token = await getPassToken(db, { memberId: betaMemberIds[0]!, secret: SECRET });
    expect(token).toBeNull();
  });

  it("returns null if member has no pass", async () => {
    const token = await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET });
    expect(token).toBeNull();
  });

  it("returns null from getPassToken if pass is revoked", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    await revokePass(db, alphaMemberIds[0]!);

    const token = await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET });
    expect(token).toBeNull();
  });

  it("returns null from lookupPass if the team is moved out of shortlisted status", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    const token = (await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET }))!;
    expect(token).toBeTruthy();

    // Verify lookupPass succeeds initially while team is shortlisted
    const initialLookup = await lookupPass(db, token);
    expect(initialLookup).not.toBeNull();
    expect(initialLookup?.memberId).toBe(alphaMemberIds[0]!);

    // Move team out of shortlisted status
    await db
      .update(teams)
      .set({ shortlistStatus: "pending" })
      .where(eq(teams.id, alphaTeamId));

    // Both getPassToken and lookupPass must now return null
    expect(await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET })).toBeNull();
    expect(await lookupPass(db, token)).toBeNull();

    // When team is restored to shortlisted, the pass resolves again
    await db
      .update(teams)
      .set({ shortlistStatus: "shortlisted" })
      .where(eq(teams.id, alphaTeamId));

    const restoredLookup = await lookupPass(db, token);
    expect(restoredLookup).not.toBeNull();
    expect(restoredLookup?.memberId).toBe(alphaMemberIds[0]!);
  });

  it("returns revoked: true from lookupPass when a pass is revoked but the team remains shortlisted", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    const token = (await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET }))!;
    expect(token).toBeTruthy();

    await revokePass(db, alphaMemberIds[0]!);

    // getPassToken returns null for revoked pass
    expect(await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET })).toBeNull();

    // lookupPass returns pass details with revoked: true
    const resolved = await lookupPass(db, token);
    expect(resolved).not.toBeNull();
    expect(resolved).toMatchObject({
      memberId: alphaMemberIds[0]!,
      teamName: "Alpha",
      revoked: true,
      checkedIn: null,
    });
  });
});

describe("checkIn", () => {
  it("checks a member in once and reports who did it the second time", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    const checkInDate = new Date("2026-10-27T03:40:00Z");

    const first = await checkIn(db, {
      memberId: alphaMemberIds[0]!,
      staffId,
      now: checkInDate,
    });
    expect(first).toEqual({ ok: true, at: checkInDate });

    const second = await checkIn(db, {
      memberId: alphaMemberIds[0]!,
      staffId,
    });
    expect(second).toEqual({
      ok: false,
      reason: "already",
      at: checkInDate,
      byName: "Gate One",
    });

    const rows = await db.select().from(attendance);
    expect(rows).toHaveLength(1);
  });

  it("lets only one of two simultaneous scans record the check-in", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });

    const results = await Promise.all([
      checkIn(db, { memberId: alphaMemberIds[1]!, staffId }),
      checkIn(db, { memberId: alphaMemberIds[1]!, staffId }),
    ]);

    const successes = results.filter((r) => r.ok);
    const duplicates = results.filter((r) => !r.ok && r.reason === "already");

    expect(successes).toHaveLength(1);
    expect(duplicates).toHaveLength(1);

    const rows = await db.select().from(attendance);
    expect(rows).toHaveLength(1);
  });

  it("refuses members without a pass", async () => {
    const result = await checkIn(db, { memberId: betaMemberIds[0]!, staffId });
    expect(result).toEqual({ ok: false, reason: "no_pass" });
  });

  it("refuses members with a revoked pass", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    await revokePass(db, alphaMemberIds[2]!);

    const result = await checkIn(db, { memberId: alphaMemberIds[2]!, staffId });
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("lookupPass shows checkedIn status after check-in", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    const token = (await getPassToken(db, { memberId: alphaMemberIds[0]!, secret: SECRET }))!;
    const checkInDate = new Date("2026-10-27T04:15:00Z");

    await checkIn(db, { memberId: alphaMemberIds[0]!, staffId, now: checkInDate });

    const resolved = await lookupPass(db, token);
    expect(resolved?.checkedIn).toEqual({
      at: checkInDate,
      byName: "Gate One",
    });
  });

  it("refuses check-in if the member's team is moved out of shortlisted status, and allows it when restored", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    const memberId = alphaMemberIds[0]!;
    const checkInDate = new Date("2026-10-27T04:30:00Z");

    // Move team out of shortlisted status
    await db
      .update(teams)
      .set({ shortlistStatus: "pending" })
      .where(eq(teams.id, alphaTeamId));

    // checkIn must fail with "no_pass" and NOT insert attendance
    const deShortlistedResult = await checkIn(db, { memberId, staffId, now: checkInDate });
    expect(deShortlistedResult).toEqual({ ok: false, reason: "no_pass" });

    const attendanceAfterReject = await db
      .select()
      .from(attendance)
      .where(eq(attendance.memberId, memberId));
    expect(attendanceAfterReject).toHaveLength(0);

    // Restore team to shortlisted status
    await db
      .update(teams)
      .set({ shortlistStatus: "shortlisted" })
      .where(eq(teams.id, alphaTeamId));

    // Existing valid, non-revoked pass can now check in successfully
    const restoredResult = await checkIn(db, { memberId, staffId, now: checkInDate });
    expect(restoredResult).toEqual({ ok: true, at: checkInDate });

    const attendanceAfterRestore = await db
      .select()
      .from(attendance)
      .where(eq(attendance.memberId, memberId));
    expect(attendanceAfterRestore).toHaveLength(1);
    expect(attendanceAfterRestore[0]!.checkedInAt).toEqual(checkInDate);
  });

  // Note on test-environment concurrency:
  // The test database uses a single PGlite connection, which serializes
  // transactions at the driver level and cannot reproduce true multi-connection
  // PostgreSQL row-lock contention. These tests verify the check-in and revocation
  // state and ordering contract under PGlite's serialized transaction execution.
  // In production, node-postgres runs with multiple connections, where
  // SELECT ... FOR UPDATE provides the actual engine-level row-lock serialization.
  describe("checkIn and revokePass race coordination", () => {
    it("Case A: checkIn obtains pass lock first, recording attendance before revocation takes effect", async () => {
      await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
      const memberId = alphaMemberIds[0]!;
      const checkInDate = new Date("2026-10-27T04:00:00Z");

      // checkIn begins its transaction first, acquiring the row lock (SELECT ... FOR UPDATE).
      // Concurrent revokePass must wait for checkIn's transaction to commit.
      const checkInPromise = checkIn(db, { memberId, staffId, now: checkInDate });
      const revokePromise = revokePass(db, memberId);

      const [checkInResult] = await Promise.all([checkInPromise, revokePromise]);

      // checkIn deterministically succeeds because it obtained the lock first
      expect(checkInResult).toEqual({ ok: true, at: checkInDate });

      // Verify attendance was atomically recorded before revocation took effect
      const attendanceRows = await db
        .select()
        .from(attendance)
        .where(eq(attendance.memberId, memberId));
      expect(attendanceRows).toHaveLength(1);
      expect(attendanceRows[0]!.checkedInAt).toEqual(checkInDate);

      // The pass is now revoked after checkIn committed
      const [pass] = await db
        .select()
        .from(checkinPasses)
        .where(eq(checkinPasses.memberId, memberId));
      expect(pass?.revokedAt).not.toBeNull();

      // Subsequent check-in fails with revoked
      const secondCheckIn = await checkIn(db, { memberId, staffId });
      expect(secondCheckIn).toEqual({ ok: false, reason: "revoked" });
    });

    it("Case B: revokePass obtains pass lock first, preventing attendance insertion", async () => {
      await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
      const memberId = alphaMemberIds[0]!;

      let lockAcquired = false;
      let finishTx!: () => void;
      const canFinish = new Promise<void>((resolve) => {
        finishTx = resolve;
      });

      // Start revocation transaction holding the row lock on checkin_passes
      const revokeTxPromise = db.transaction(async (tx) => {
        await revokePass(tx as unknown as Db, memberId);
        lockAcquired = true;

        // Hold the transaction and row lock open until checkIn has arrived and blocked
        await canFinish;
      });

      // Ensure the revocation transaction has acquired its lock
      await new Promise((r) => setImmediate(r));
      expect(lockAcquired).toBe(true);

      // checkIn attempts to acquire the pass lock and must wait for revocation to commit
      const checkInPromise = checkIn(db, { memberId, staffId });

      // Release revocation transaction to commit
      finishTx();
      await revokeTxPromise;

      // checkIn unblocks, observes the committed revoked status, and rejects
      const checkInResult = await checkInPromise;
      expect(checkInResult).toEqual({ ok: false, reason: "revoked" });

      // Verify NO attendance record was inserted
      const attendanceRows = await db
        .select()
        .from(attendance)
        .where(eq(attendance.memberId, memberId));
      expect(attendanceRows).toHaveLength(0);
    });

    it("Case C: concurrent checkIn and revokePass execution guarantees atomic ordering without inconsistent state", async () => {
      await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
      const memberId = alphaMemberIds[0]!;

      const [checkInResult] = await Promise.all([
        checkIn(db, { memberId, staffId }),
        revokePass(db, memberId),
      ]);

      const attendanceRows = await db
        .select()
        .from(attendance)
        .where(eq(attendance.memberId, memberId));
      const [pass] = await db
        .select()
        .from(checkinPasses)
        .where(eq(checkinPasses.memberId, memberId));

      // The pass must always end up revoked
      expect(pass?.revokedAt).not.toBeNull();

      if (checkInResult.ok) {
        // If checkIn acquired the row lock first, attendance was atomically recorded before revocation
        expect(attendanceRows).toHaveLength(1);
        expect(checkInResult).toEqual({ ok: true, at: attendanceRows[0]!.checkedInAt });
      } else {
        // If revocation committed first, checkIn saw the revoked state and inserted no attendance
        expect(checkInResult).toEqual({ ok: false, reason: "revoked" });
        expect(attendanceRows).toHaveLength(0);
      }
    });
  });
});

describe("revokePass", () => {
  it("marks pass as revoked and is idempotent", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });

    await revokePass(db, alphaMemberIds[0]!);
    const [pass] = await db
      .select()
      .from(checkinPasses)
      .where(eq(checkinPasses.memberId, alphaMemberIds[0]!));
    expect(pass?.revokedAt).not.toBeNull();

    // Calling it again does not throw or change data destructively
    await revokePass(db, alphaMemberIds[0]!);
  });
});

describe("searchCheckin", () => {
  it("searches shortlisted members by name, regNumber, teamName case-insensitively and excludes non-shortlisted", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    await checkIn(db, { memberId: alphaMemberIds[0]!, staffId });

    // Team name search (case-insensitive)
    const byTeam = await searchCheckin(db, "alpha");
    expect(byTeam.map((r) => r.memberId).sort()).toEqual([...alphaMemberIds].sort());

    // Non-shortlisted team is excluded
    const byBeta = await searchCheckin(db, "beta");
    expect(byBeta).toEqual([]);

    // First name search
    const byFirstName = await searchCheckin(db, "alice");
    expect(byFirstName).toHaveLength(1);
    expect(byFirstName[0]!.memberId).toBe(alphaMemberIds[0]);
    expect(byFirstName[0]!.hasPass).toBe(true);
    expect(byFirstName[0]!.checkedInAt).not.toBeNull();

    // Registration number partial match
    const byReg = await searchCheckin(db, "10002");
    expect(byReg).toHaveLength(1);
    expect(byReg[0]!.memberId).toBe(alphaMemberIds[1]);

    // Empty or whitespace returns empty array
    expect(await searchCheckin(db, "")).toEqual([]);
    expect(await searchCheckin(db, "   ")).toEqual([]);
  });

  it("limits results to 20", async () => {
    // Add 25 members to shortlisted team Alpha
    const extraMembers = Array.from({ length: 25 }, (_, i) => ({
      teamId: alphaTeamId,
      position: 10 + i,
      isLeader: false,
      firstName: `Extra${i}`,
      lastName: "Tester",
      regNumber: `RA26110260199${String(i).padStart(2, "0")}`,
      srmEmail: `extra${i}@srmist.edu.in`,
      personalEmail: `extra${i}@example.com`,
      phone: `91111111${String(i).padStart(2, "0")}`,
    }));
    await db.insert(members).values(extraMembers);

    const results = await searchCheckin(db, "Tester");
    expect(results).toHaveLength(20);
  });
});

describe("attendanceSummary", () => {
  it("correctly summarizes expected and present counts for shortlisted teams", async () => {
    await issuePassesForTeam(db, { teamId: alphaTeamId, secret: SECRET });
    await checkIn(db, { memberId: alphaMemberIds[0]!, staffId });

    const summary = await attendanceSummary(db);
    expect(summary).toEqual([
      {
        teamId: alphaTeamId,
        teamName: "Alpha",
        expected: 3,
        present: 1,
      },
    ]);
  });
});
