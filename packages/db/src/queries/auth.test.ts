import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../client";
import { emailOtps, members, staff, teams } from "../schema";
import { createTestDb } from "../test-utils";
import { claimVerifiedOtp, createSession, findMemberByEmail, findStaffByEmail, getMemberWithTeam, getSession, getStaffById, issueOtp, revokeSession, verifyOtp } from "./auth";

let db: Db;
const email = "m1@srmist.edu.in";
const t0 = new Date("2026-10-01T10:00:00Z");
const at = (seconds: number) => new Date(t0.getTime() + seconds * 1000);

beforeEach(async () => {
  db = await createTestDb();
});

describe("issueOtp", () => {
  it("issues a six-digit code", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(r.ok && r.code).toMatch(/^\d{6}$/);
  });
  it("refuses a second code within 60 seconds, then allows it", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(await issueOtp(db, { email, purpose: "registration", now: at(30) })).toEqual({ ok: false, reason: "too_soon", retryAfterSeconds: 30 });
    expect((await issueOtp(db, { email, purpose: "registration", now: at(60) })).ok).toBe(true);
  });
  it("keeps purposes separate", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect((await issueOtp(db, { email, purpose: "participant_sign_in", now: at(1) })).ok).toBe(true);
  });
});

describe("verifyOtp", () => {
  it("accepts the right code once", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const code = r.ok ? r.code : "";
    expect(await verifyOtp(db, { email, purpose: "registration", code, now: at(5) })).toEqual({ ok: true });
    expect(await verifyOtp(db, { email, purpose: "registration", code, now: at(6) })).toEqual({ ok: false, reason: "not_found" });
  });
  it("only honours the newest code", async () => {
    const first = await issueOtp(db, { email, purpose: "registration", now: t0 });
    await issueOtp(db, { email, purpose: "registration", now: at(61) });
    expect(await verifyOtp(db, { email, purpose: "registration", code: first.ok ? first.code : "", now: at(62) })).toEqual({ ok: false, reason: "invalid" });
  });
  it("expires after 10 minutes", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(601) })).toEqual({ ok: false, reason: "expired" });
  });
  it("locks after 5 wrong attempts, even for the right code", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const wrong = r.ok && r.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      expect(await verifyOtp(db, { email, purpose: "registration", code: wrong, now: at(1) })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(2) })).toEqual({ ok: false, reason: "too_many_attempts" });
  });
  it("reports not_found when no code was issued", async () => {
    expect(await verifyOtp(db, { email, purpose: "staff_sign_in", code: "123456", now: t0 })).toEqual({ ok: false, reason: "not_found" });
  });
  it("counts every concurrent wrong guess", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const wrong = r.ok && r.code === "000000" ? "111111" : "000000";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => verifyOtp(db, { email, purpose: "registration", code: wrong, now: at(1) })),
    );
    const invalid = results.filter((res) => !res.ok && res.reason === "invalid");
    const lockedOut = results.filter((res) => !res.ok && res.reason === "too_many_attempts");
    expect(invalid).toHaveLength(5);
    expect(lockedOut).toHaveLength(5);
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(2) })).toEqual({ ok: false, reason: "too_many_attempts" });
  });
  it("lets only one of several concurrent correct verifies succeed", async () => {
    const r = await issueOtp(db, { email, purpose: "registration", now: t0 });
    const code = r.ok ? r.code : "";
    const results = await Promise.all(
      Array.from({ length: 5 }, () => verifyOtp(db, { email, purpose: "registration", code, now: at(1) })),
    );
    const succeeded = results.filter((res) => res.ok);
    const notFound = results.filter((res) => !res.ok && res.reason === "not_found");
    expect(succeeded).toHaveLength(1);
    expect(notFound).toHaveLength(4);
  });
});

describe("claimVerifiedOtp", () => {
  async function issueAndVerify(when: Date) {
    const r = await issueOtp(db, { email, purpose: "registration", now: when });
    const code = r.ok ? r.code : "";
    expect(await verifyOtp(db, { email, purpose: "registration", code, now: when })).toEqual({ ok: true });
  }

  it("records when a code was verified", async () => {
    await issueAndVerify(t0);
    const [row] = await db.select().from(emailOtps);
    expect(row!.verifiedAt?.toISOString()).toBe(t0.toISOString());
    expect(row!.consumedAt?.toISOString()).toBe(t0.toISOString());
    expect(row!.claimedAt).toBeNull();
  });
  it("refuses when the code was never verified", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    expect(await claimVerifiedOtp(db, { email, purpose: "registration", now: at(5) })).toBe(false);
  });
  it("claims a verified code once, then refuses reuse", async () => {
    await issueAndVerify(t0);
    expect(await claimVerifiedOtp(db, { email, purpose: "registration", now: at(60) })).toBe(true);
    expect(await claimVerifiedOtp(db, { email, purpose: "registration", now: at(61) })).toBe(false);
  });
  it("refuses a code verified more than 30 minutes ago", async () => {
    await issueAndVerify(t0);
    expect(await claimVerifiedOtp(db, { email, purpose: "registration", now: at(31 * 60) })).toBe(false);
  });
  it("refuses a code that was superseded without being verified", async () => {
    await issueOtp(db, { email, purpose: "registration", now: t0 });
    await issueOtp(db, { email, purpose: "registration", now: at(61) });
    expect(await claimVerifiedOtp(db, { email, purpose: "registration", now: at(62) })).toBe(false);
  });
  it("keeps purposes separate", async () => {
    await issueAndVerify(t0);
    expect(await claimVerifiedOtp(db, { email, purpose: "participant_sign_in", now: at(5) })).toBe(false);
  });
  it("works inside a transaction", async () => {
    await issueAndVerify(t0);
    const claimed = await db.transaction((tx) => claimVerifiedOtp(tx, { email, purpose: "registration", now: at(5) }));
    expect(claimed).toBe(true);
  });
});

describe("email normalization", () => {
  it("treats differently-cased and padded emails as the same address", async () => {
    const r = await issueOtp(db, { email: " M1@SRMIST.EDU.IN ", purpose: "registration", now: t0 });
    expect(await issueOtp(db, { email, purpose: "registration", now: at(1) })).toMatchObject({ ok: false, reason: "too_soon" });
    expect(await verifyOtp(db, { email, purpose: "registration", code: r.ok ? r.code : "", now: at(5) })).toEqual({ ok: true });
    expect(await claimVerifiedOtp(db, { email: "M1@srmist.edu.in ", purpose: "registration", now: at(6) })).toBe(true);
  });
  it("finds members and staff with a mixed-case lookup", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values({ teamId: team!.id, position: 1, isLeader: true, firstName: "A", lastName: "B", regNumber: "RA2611026010691", srmEmail: email, personalEmail: "a@gmail.com", phone: "9876543211" });
    await db.insert(staff).values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" });
    expect((await findMemberByEmail(db, " M1@SrmIst.edu.in"))?.teamId).toBe(team!.id);
    expect((await findStaffByEmail(db, "Admin@SRMIST.edu.in "))?.role).toBe("admin");
  });
});

describe("daily OTP cap", () => {
  it("refuses the 11th code for an email and purpose within 24 hours", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await issueOtp(db, { email, purpose: "registration", now: at(i * 61) })).ok).toBe(true);
    }
    expect(await issueOtp(db, { email, purpose: "registration", now: at(10 * 61) })).toEqual({ ok: false, reason: "daily_limit" });
    expect((await issueOtp(db, { email, purpose: "participant_sign_in", now: at(10 * 61) })).ok).toBe(true);
    expect((await issueOtp(db, { email: "m2@srmist.edu.in", purpose: "registration", now: at(10 * 61) })).ok).toBe(true);
  });
  it("allows codes again once the oldest is more than 24 hours old", async () => {
    for (let i = 0; i < 10; i++) {
      await issueOtp(db, { email, purpose: "registration", now: at(i * 61) });
    }
    expect((await issueOtp(db, { email, purpose: "registration", now: at(24 * 3600 + 1) })).ok).toBe(true);
  });
});

describe("issueOtp concurrency", () => {
  it("issues only one code for concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, () => issueOtp(db, { email, purpose: "registration", now: t0 })),
    );
    const succeeded = results.filter((res) => res.ok);
    const tooSoon = results.filter((res) => !res.ok && res.reason === "too_soon");
    expect(succeeded).toHaveLength(1);
    expect(tooSoon).toHaveLength(2);
  });
});

describe("sessions", () => {
  it("creates, reads and revokes a session", async () => {
    const subjectId = "00000000-0000-4000-8000-000000000001";
    const { token, expiresAt } = await createSession(db, { subjectType: "member", subjectId, now: t0 });
    expect(expiresAt.toISOString()).toBe("2026-10-08T10:00:00.000Z");
    expect(await getSession(db, token, at(10))).toEqual({ subjectType: "member", subjectId, expiresAt });
    await revokeSession(db, token);
    expect(await getSession(db, token, at(11))).toBeNull();
  });
  it("treats an expired or unknown session as signed out", async () => {
    const { token } = await createSession(db, { subjectType: "staff", subjectId: "00000000-0000-4000-8000-000000000002", now: t0 });
    expect(await getSession(db, token, new Date("2026-10-08T10:00:01Z"))).toBeNull();
    expect(await getSession(db, "not-a-token", t0)).toBeNull();
  });
});

describe("lookups", () => {
  it("finds members and staff by email", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    await db.insert(members).values({ teamId: team!.id, position: 1, isLeader: true, firstName: "A", lastName: "B", regNumber: "RA2611026010691", srmEmail: email, personalEmail: "a@gmail.com", phone: "9876543211" });
    await db.insert(staff).values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" });
    expect((await findMemberByEmail(db, email))?.teamId).toBe(team!.id);
    expect((await findStaffByEmail(db, "admin@srmist.edu.in"))?.role).toBe("admin");
    expect(await findMemberByEmail(db, "nobody@srmist.edu.in")).toBeNull();
  });
});

describe("guards' lookups", () => {
  const missing = "00000000-0000-4000-8000-000000000009";
  it("returns a member with their team, or null", async () => {
    const [team] = await db.insert(teams).values({ name: "A", nameKey: "a", track: "Track A" }).returning();
    const [member] = await db.insert(members).values({ teamId: team!.id, position: 1, isLeader: true, firstName: "A", lastName: "B", regNumber: "RA2611026010691", srmEmail: email, personalEmail: "a@gmail.com", phone: "9876543211" }).returning();
    const found = await getMemberWithTeam(db, member!.id);
    expect(found?.member.id).toBe(member!.id);
    expect(found?.member.srmEmail).toBe(email);
    expect(found?.team.id).toBe(team!.id);
    expect(found?.team.name).toBe("A");
    expect(await getMemberWithTeam(db, missing)).toBeNull();
  });
  it("returns a staff row by id, or null", async () => {
    const [row] = await db.insert(staff).values({ email: "admin@srmist.edu.in", name: "Admin", role: "admin" }).returning();
    expect(await getStaffById(db, row!.id)).toEqual(row);
    expect(await getStaffById(db, missing)).toBeNull();
  });
});
