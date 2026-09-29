// Flow C, admin: overview, team list/detail and export queries. Admin flow (Ujaan, Ritwik).
// Plan: docs/superpowers/plans/2026-09-26-flow-admin.md
import { csvCell } from "@pandora/core";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../client";
import { editRequests, members, paymentProofs, submissions, teams } from "../schema";

export async function getOverview(db: Db): Promise<{
  teams: number;
  members: number;
  byTrack: Record<string, number>;
  paymentPending: number;
  editRequestsPending: number;
  submissions: number;
  shortlisted: number;
}> {
  const [
    teamRows,
    memberRows,
    trackRows,
    paymentPendingRows,
    editRequestRows,
    submissionRows,
    shortlistedRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(teams),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(members),
    db
      .select({ track: teams.track, count: sql<number>`cast(count(*) as int)` })
      .from(teams)
      .groupBy(teams.track),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(teams)
      .where(eq(teams.paymentStatus, "pending")),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(editRequests)
      .where(eq(editRequests.status, "pending")),
    db.select({ count: sql<number>`cast(count(*) as int)` }).from(submissions),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(teams)
      .where(eq(teams.shortlistStatus, "shortlisted")),
  ]);

  return {
    teams: teamRows[0]?.count ?? 0,
    members: memberRows[0]?.count ?? 0,
    byTrack: Object.fromEntries(trackRows.map((row) => [row.track, row.count])),
    paymentPending: paymentPendingRows[0]?.count ?? 0,
    editRequestsPending: editRequestRows[0]?.count ?? 0,
    submissions: submissionRows[0]?.count ?? 0,
    shortlisted: shortlistedRows[0]?.count ?? 0,
  };
}

export async function listTeams(
  db: Db,
  filter?: {
    search?: string;
    track?: string;
    shortlistStatus?: "pending" | "shortlisted" | "not_shortlisted";
    limit?: number;
    offset?: number;
  },
): Promise<
  Array<{
    id: string;
    name: string;
    track: string;
    paymentStatus: string;
    shortlistStatus: string;
    memberCount: number;
    leaderName: string;
    createdAt: Date;
  }>
> {
  const conditions: SQL[] = [];
  const search = filter?.search?.trim();

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(teams.name, pattern),
        inArray(
          teams.id,
          db
            .select({ teamId: members.teamId })
            .from(members)
            .where(
              or(
                ilike(members.firstName, pattern),
                ilike(members.lastName, pattern),
                sql`${members.firstName} || ' ' || ${members.lastName} ilike ${pattern}`,
                ilike(members.regNumber, pattern),
                ilike(members.srmEmail, pattern),
              ),
            ),
        ),
      )!,
    );
  }

  if (filter?.track) {
    conditions.push(eq(teams.track, filter.track));
  }

  if (filter?.shortlistStatus) {
    conditions.push(eq(teams.shortlistStatus, filter.shortlistStatus));
  }

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      track: teams.track,
      paymentStatus: teams.paymentStatus,
      shortlistStatus: teams.shortlistStatus,
      memberCount: sql<number>`cast(count(${members.id}) as int)`,
      leaderName: sql<string>`max(case when ${members.isLeader} then ${members.firstName} || ' ' || ${members.lastName} end)`,
      createdAt: teams.createdAt,
    })
    .from(teams)
    .innerJoin(members, eq(members.teamId, teams.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(
      teams.id,
      teams.name,
      teams.track,
      teams.paymentStatus,
      teams.shortlistStatus,
      teams.createdAt,
    )
    .orderBy(desc(teams.createdAt))
    .limit(filter?.limit ?? 50)
    .offset(filter?.offset ?? 0);

  return rows;
}

export async function getTeamDetail(
  db: Db,
  teamId: string,
): Promise<
  | {
      team: typeof teams.$inferSelect;
      members: Array<typeof members.$inferSelect>;
      paymentProofs: Array<typeof paymentProofs.$inferSelect>;
      editRequests: Array<typeof editRequests.$inferSelect>;
      submission: typeof submissions.$inferSelect | null;
    }
  | null
> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

  if (!team) {
    return null;
  }

  const [teamMembers, teamPaymentProofs, teamEditRequests, submissionRows] = await Promise.all([
    db.select().from(members).where(eq(members.teamId, teamId)).orderBy(asc(members.position)),
    db.select().from(paymentProofs).where(eq(paymentProofs.teamId, teamId)).orderBy(desc(paymentProofs.createdAt)),
    db.select().from(editRequests).where(eq(editRequests.teamId, teamId)).orderBy(desc(editRequests.createdAt)),
    db
      .select()
      .from(submissions)
      .where(and(eq(submissions.teamId, teamId), eq(submissions.episode, 0)))
      .limit(1),
  ]);

  return {
    team,
    members: teamMembers,
    paymentProofs: teamPaymentProofs,
    editRequests: teamEditRequests,
    submission: submissionRows[0] ?? null,
  };
}

export async function exportTeamsCsv(db: Db): Promise<string> {
  const rows = await db
    .select({
      teamName: teams.name,
      track: teams.track,
      paymentStatus: teams.paymentStatus,
      shortlistStatus: teams.shortlistStatus,
      position: members.position,
      isLeader: members.isLeader,
      firstName: members.firstName,
      lastName: members.lastName,
      regNumber: members.regNumber,
      srmEmail: members.srmEmail,
      personalEmail: members.personalEmail,
      phone: members.phone,
    })
    .from(teams)
    .innerJoin(members, eq(members.teamId, teams.id))
    .orderBy(asc(teams.name), asc(members.position));

  const header = "team_name,track,payment_status,shortlist_status,position,is_leader,first_name,last_name,reg_number,srm_email,personal_email,phone";
  const csvRows = rows.map((row) =>
    [
      row.teamName,
      row.track,
      row.paymentStatus,
      row.shortlistStatus,
      row.position,
      row.isLeader,
      row.firstName,
      row.lastName,
      row.regNumber,
      row.srmEmail,
      row.personalEmail,
      row.phone,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header, ...csvRows].join("\n");
}
