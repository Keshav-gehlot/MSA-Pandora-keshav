import { createHmac, randomUUID } from "node:crypto";
import { hashToken } from "@pandora/core/server";
import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "../client";
import { attendance, checkinPasses, members, staff, teams } from "../schema";

export const CHECKIN_EVENT = "episode_1";

function computePassToken(secret: string, passId: string): string {
  return createHmac("sha256", secret).update(passId).digest("base64url");
}

export async function issuePassesForTeam(
  db: Db,
  input: { teamId: string; secret: string; now?: Date },
): Promise<{ ok: true; issued: number } | { ok: false; reason: "not_shortlisted" }> {
  const [team] = await db
    .select({ id: teams.id, shortlistStatus: teams.shortlistStatus })
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .limit(1);

  if (!team || team.shortlistStatus !== "shortlisted") {
    return { ok: false, reason: "not_shortlisted" };
  }

  const teamMembers = await db
    .select({ id: members.id })
    .from(members)
    .where(eq(members.teamId, input.teamId));

  if (teamMembers.length === 0) {
    return { ok: true, issued: 0 };
  }

  const teamMemberIds = teamMembers.map((m) => m.id);
  const existingPasses = await db
    .select({ memberId: checkinPasses.memberId })
    .from(checkinPasses)
    .where(inArray(checkinPasses.memberId, teamMemberIds));

  const existingMemberIds = new Set(existingPasses.map((p) => p.memberId));
  const membersNeedingPass = teamMembers.filter((m) => !existingMemberIds.has(m.id));

  if (membersNeedingPass.length === 0) {
    return { ok: true, issued: 0 };
  }

  const issuedAt = input.now ?? new Date();
  const rowsToInsert = membersNeedingPass.map((m) => {
    const passId = randomUUID();
    const token = computePassToken(input.secret, passId);
    return {
      id: passId,
      memberId: m.id,
      tokenHash: hashToken(token),
      issuedAt,
    };
  });

  const inserted = await db
    .insert(checkinPasses)
    .values(rowsToInsert)
    .onConflictDoNothing({ target: checkinPasses.memberId })
    .returning({ id: checkinPasses.id });

  return { ok: true, issued: inserted.length };
}

export async function getPassToken(
  db: Db,
  input: { memberId: string; secret: string },
): Promise<string | null> {
  const [row] = await db
    .select({
      passId: checkinPasses.id,
      revokedAt: checkinPasses.revokedAt,
      shortlistStatus: teams.shortlistStatus,
    })
    .from(checkinPasses)
    .innerJoin(members, eq(checkinPasses.memberId, members.id))
    .innerJoin(teams, eq(members.teamId, teams.id))
    .where(eq(checkinPasses.memberId, input.memberId))
    .limit(1);

  if (!row || row.revokedAt !== null || row.shortlistStatus !== "shortlisted") {
    return null;
  }

  return computePassToken(input.secret, row.passId);
}

export async function lookupPass(
  db: Db,
  token: string,
): Promise<null | {
  memberId: string;
  memberName: string;
  regNumber: string;
  photoPath: string | null;
  teamName: string;
  track: string;
  revoked: boolean;
  checkedIn: { at: Date; byName: string } | null;
}> {
  const tokenHash = hashToken(token);

  const [row] = await db
    .select({
      passId: checkinPasses.id,
      revokedAt: checkinPasses.revokedAt,
      memberId: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      regNumber: members.regNumber,
      photoPath: members.photoPath,
      teamName: teams.name,
      track: teams.track,
    })
    .from(checkinPasses)
    .innerJoin(members, eq(checkinPasses.memberId, members.id))
    .innerJoin(teams, eq(members.teamId, teams.id))
    .where(
      and(
        eq(checkinPasses.tokenHash, tokenHash),
        eq(teams.shortlistStatus, "shortlisted"),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const [att] = await db
    .select({
      checkedInAt: attendance.checkedInAt,
      byName: staff.name,
    })
    .from(attendance)
    .innerJoin(staff, eq(attendance.checkedInBy, staff.id))
    .where(and(eq(attendance.memberId, row.memberId), eq(attendance.event, CHECKIN_EVENT)))
    .limit(1);

  return {
    memberId: row.memberId,
    memberName: `${row.firstName} ${row.lastName}`.trim(),
    regNumber: row.regNumber,
    photoPath: row.photoPath,
    teamName: row.teamName,
    track: row.track,
    revoked: row.revokedAt !== null,
    checkedIn: att ? { at: att.checkedInAt, byName: att.byName } : null,
  };
}

export async function checkIn(
  db: Db,
  input: { memberId: string; staffId: string; now?: Date },
): Promise<
  | { ok: true; at: Date }
  | { ok: false; reason: "already"; at: Date; byName: string }
  | { ok: false; reason: "no_pass" | "revoked" }
> {
  return db.transaction(async (tx) => {
    const [pass] = await tx
      .select({
        id: checkinPasses.id,
        revokedAt: checkinPasses.revokedAt,
      })
      .from(checkinPasses)
      .innerJoin(members, eq(checkinPasses.memberId, members.id))
      .innerJoin(teams, eq(members.teamId, teams.id))
      .where(
        and(
          eq(checkinPasses.memberId, input.memberId),
          eq(teams.shortlistStatus, "shortlisted"),
        ),
      )
      .for("update", { of: checkinPasses })
      .limit(1);

    if (!pass) {
      return { ok: false, reason: "no_pass" };
    }

    if (pass.revokedAt !== null) {
      return { ok: false, reason: "revoked" };
    }

    const checkInTime = input.now ?? new Date();

    const inserted = await tx
      .insert(attendance)
      .values({
        memberId: input.memberId,
        event: CHECKIN_EVENT,
        checkedInAt: checkInTime,
        checkedInBy: input.staffId,
      })
      .onConflictDoNothing({ target: [attendance.memberId, attendance.event] })
      .returning({ at: attendance.checkedInAt });

    if (inserted.length > 0 && inserted[0]) {
      return { ok: true, at: inserted[0].at };
    }

    const [existing] = await tx
      .select({
        at: attendance.checkedInAt,
        byName: staff.name,
      })
      .from(attendance)
      .innerJoin(staff, eq(attendance.checkedInBy, staff.id))
      .where(and(eq(attendance.memberId, input.memberId), eq(attendance.event, CHECKIN_EVENT)))
      .limit(1);

    return {
      ok: false,
      reason: "already",
      at: existing?.at ?? checkInTime,
      byName: existing?.byName ?? "Staff",
    };
  });
}

export async function revokePass(db: Db, memberId: string): Promise<void> {
  await db
    .update(checkinPasses)
    .set({ revokedAt: new Date() })
    .where(and(eq(checkinPasses.memberId, memberId), isNull(checkinPasses.revokedAt)));
}

export async function searchCheckin(
  db: Db,
  query: string,
): Promise<
  Array<{
    memberId: string;
    memberName: string;
    regNumber: string;
    teamName: string;
    hasPass: boolean;
    checkedInAt: Date | null;
  }>
> {
  const trimmed = query.trim();
  if (trimmed === "") {
    return [];
  }

  const pattern = `%${trimmed}%`;

  const rows = await db
    .select({
      memberId: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      regNumber: members.regNumber,
      teamName: teams.name,
      passId: checkinPasses.id,
      revokedAt: checkinPasses.revokedAt,
      checkedInAt: attendance.checkedInAt,
    })
    .from(members)
    .innerJoin(teams, eq(members.teamId, teams.id))
    .leftJoin(checkinPasses, eq(members.id, checkinPasses.memberId))
    .leftJoin(
      attendance,
      and(eq(members.id, attendance.memberId), eq(attendance.event, CHECKIN_EVENT)),
    )
    .where(
      and(
        eq(teams.shortlistStatus, "shortlisted"),
        or(
          ilike(members.firstName, pattern),
          ilike(members.lastName, pattern),
          sql`${members.firstName} || ' ' || ${members.lastName} ILIKE ${pattern}`,
          ilike(members.regNumber, pattern),
          ilike(teams.name, pattern),
        ),
      ),
    )
    .limit(20);

  return rows.map((r) => ({
    memberId: r.memberId,
    memberName: `${r.firstName} ${r.lastName}`.trim(),
    regNumber: r.regNumber,
    teamName: r.teamName,
    hasPass: r.passId !== null && r.revokedAt === null,
    checkedInAt: r.checkedInAt ?? null,
  }));
}

export async function attendanceSummary(
  db: Db,
): Promise<
  Array<{
    teamId: string;
    teamName: string;
    expected: number;
    present: number;
  }>
> {
  const rows = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      expected: sql<number>`cast(count(distinct ${members.id}) as int)`,
      present: sql<number>`cast(count(distinct case when ${attendance.id} is not null then ${members.id} end) as int)`,
    })
    .from(teams)
    .innerJoin(members, eq(teams.id, members.teamId))
    .leftJoin(
      attendance,
      and(eq(members.id, attendance.memberId), eq(attendance.event, CHECKIN_EVENT)),
    )
    .where(eq(teams.shortlistStatus, "shortlisted"))
    .groupBy(teams.id, teams.name)
    .orderBy(asc(teams.name));

  return rows.map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    expected: Number(r.expected),
    present: Number(r.present),
  }));
}
