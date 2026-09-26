import { OTP } from "@pandora/core";
import { generateOtpCode, generateToken, hashOtp, hashToken, otpExpiry, safeEqualHex, sessionExpiry } from "@pandora/core/server";
import { and, count, desc, eq, gt, gte, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "../client";
import { emailOtps, members, sessions, staff, teams } from "../schema";

export type OtpPurpose = "registration" | "participant_sign_in" | "staff_sign_in";

// Every query here compares emails in one canonical form, whatever the caller passed.
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const DAY_MS = 24 * 60 * 60_000;

async function latestOpenOtp(db: Db, email: string, purpose: OtpPurpose) {
  const [row] = await db
    .select()
    .from(emailOtps)
    .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose), isNull(emailOtps.consumedAt)))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);
  return row ?? null;
}

export async function issueOtp(
  db: Db,
  { email: rawEmail, purpose, now = new Date() }: { email: string; purpose: OtpPurpose; now?: Date },
): Promise<
  | { ok: true; code: string }
  | { ok: false; reason: "too_soon"; retryAfterSeconds: number }
  | { ok: false; reason: "daily_limit" }
> {
  const email = normalizeEmail(rawEmail);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email} || ':' || ${purpose}))`);

    const [issuedToday] = await tx
      .select({ n: count() })
      .from(emailOtps)
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose), gt(emailOtps.createdAt, new Date(now.getTime() - DAY_MS))));
    if ((issuedToday?.n ?? 0) >= OTP.maxPerDay) return { ok: false, reason: "daily_limit" };

    const previous = await latestOpenOtp(tx, email, purpose);
    if (previous) {
      const elapsed = Math.floor((now.getTime() - previous.createdAt.getTime()) / 1000);
      if (elapsed < OTP.resendSeconds) return { ok: false, reason: "too_soon", retryAfterSeconds: OTP.resendSeconds - elapsed };
    }
    const code = generateOtpCode();
    await tx
      .update(emailOtps)
      .set({ consumedAt: now })
      .where(and(eq(emailOtps.email, email), eq(emailOtps.purpose, purpose), isNull(emailOtps.consumedAt)));
    await tx.insert(emailOtps).values({ email, purpose, codeHash: hashOtp(email, code), expiresAt: otpExpiry(now), createdAt: now });
    return { ok: true, code };
  });
}

export async function verifyOtp(
  db: Db,
  { email: rawEmail, purpose, code, now = new Date() }: { email: string; purpose: OtpPurpose; code: string; now?: Date },
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "invalid" }> {
  const email = normalizeEmail(rawEmail);
  const row = await latestOpenOtp(db, email, purpose);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (row.attempts >= OTP.maxAttempts) return { ok: false, reason: "too_many_attempts" };
  if (!safeEqualHex(row.codeHash, hashOtp(email, code))) {
    const [locked] = await db
      .update(emailOtps)
      .set({ attempts: sql`${emailOtps.attempts} + 1` })
      .where(and(eq(emailOtps.id, row.id), isNull(emailOtps.consumedAt), lt(emailOtps.attempts, OTP.maxAttempts)))
      .returning({ attempts: emailOtps.attempts });
    if (!locked) return { ok: false, reason: "too_many_attempts" };
    return { ok: false, reason: "invalid" };
  }
  const [consumed] = await db
    .update(emailOtps)
    .set({ consumedAt: now, verifiedAt: now })
    .where(and(eq(emailOtps.id, row.id), isNull(emailOtps.consumedAt), lt(emailOtps.attempts, OTP.maxAttempts)))
    .returning({ id: emailOtps.id });
  if (!consumed) return { ok: false, reason: "not_found" };
  return { ok: true };
}

// Proof that the email was verified recently, usable once. Flow A calls it inside its registration transaction,
// so a verified code can't be replayed to register a second team.
export async function claimVerifiedOtp(
  db: Db,
  { email: rawEmail, purpose, withinMinutes = 30, now = new Date() }: { email: string; purpose: OtpPurpose; withinMinutes?: number; now?: Date },
): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  const cutoff = new Date(now.getTime() - withinMinutes * 60_000);
  const newest = db
    .select({ id: emailOtps.id })
    .from(emailOtps)
    .where(
      and(
        eq(emailOtps.email, email),
        eq(emailOtps.purpose, purpose),
        gte(emailOtps.verifiedAt, cutoff),
        isNull(emailOtps.claimedAt),
      ),
    )
    .orderBy(desc(emailOtps.verifiedAt))
    .limit(1);
  const claimed = await db
    .update(emailOtps)
    .set({ claimedAt: now })
    .where(and(sql`${emailOtps.id} = (${newest})`, isNull(emailOtps.claimedAt)))
    .returning({ id: emailOtps.id });
  return claimed.length > 0;
}

export async function createSession(
  db: Db,
  { subjectType, subjectId, now = new Date() }: { subjectType: "member" | "staff"; subjectId: string; now?: Date },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = sessionExpiry(now);
  await db.insert(sessions).values({ tokenHash: hashToken(token), subjectType, subjectId, expiresAt, createdAt: now });
  return { token, expiresAt };
}

export async function getSession(
  db: Db,
  token: string,
  now: Date = new Date(),
): Promise<{ subjectType: "member" | "staff"; subjectId: string; expiresAt: Date } | null> {
  const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, hashToken(token))).limit(1);
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return { subjectType: row.subjectType, subjectId: row.subjectId, expiresAt: row.expiresAt };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function findMemberByEmail(db: Db, email: string) {
  const [row] = await db.select().from(members).where(eq(members.srmEmail, normalizeEmail(email))).limit(1);
  return row ?? null;
}

export async function findStaffByEmail(db: Db, email: string) {
  const [row] = await db.select().from(staff).where(eq(staff.email, normalizeEmail(email))).limit(1);
  return row ?? null;
}

// For the apps' session guards: the signed-in member and their team, or null when the member no longer exists.
export async function getMemberWithTeam(db: Db, memberId: string) {
  const [row] = await db
    .select({ member: members, team: teams })
    .from(members)
    .innerJoin(teams, eq(members.teamId, teams.id))
    .where(eq(members.id, memberId))
    .limit(1);
  return row ?? null;
}

export async function getStaffById(db: Db, staffId: string) {
  const [row] = await db.select().from(staff).where(eq(staff.id, staffId)).limit(1);
  return row ?? null;
}
