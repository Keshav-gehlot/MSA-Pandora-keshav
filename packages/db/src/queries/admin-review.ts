import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import {
  adminActions,
  members,
  notifications,
  paymentProofs,
  submissions,
  teams,
} from "../schema";

export async function recordAdminAction(
  db: Db,
  input: {
    staffId: string;
    action: string;
    targetType: string;
    targetId: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(adminActions).values({
    staffId: input.staffId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    detail: input.detail,
  });
}

export async function createNotification(
  db: Db,
  input: {
    staffId: string;
    teamId: string | null;
    title: string;
    body: string;
  },
): Promise<{ id: string }> {
  return await db.transaction(async (tx) => {
    const [notification] = await tx
      .insert(notifications)
      .values({
        teamId: input.teamId,
        title: input.title,
        body: input.body,
        createdBy: input.staffId,
      })
      .returning({ id: notifications.id });

    await recordAdminAction(tx, {
      staffId: input.staffId,
      action: "notification.created",
      targetType: "notification",
      targetId: notification!.id,
      detail: { teamId: input.teamId },
    });

    return notification!;
  });
}

export async function listNotifications(
  db: Db,
): Promise<
  Array<{
    id: string;
    teamId: string | null;
    teamName: string | null;
    title: string;
    body: string;
    createdAt: Date;
  }>
> {
  return await db
    .select({
      id: notifications.id,
      teamId: notifications.teamId,
      teamName: teams.name,
      title: notifications.title,
      body: notifications.body,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(teams, eq(notifications.teamId, teams.id))
    .orderBy(desc(notifications.createdAt));
}

export async function listNoticeTeams(db: Db): Promise<Array<{ id: string; name: string }>> {
  return await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .orderBy(asc(teams.name));
}

export async function listPendingPayments(
  db: Db,
): Promise<Array<{ proofId: string; teamId: string; teamName: string; filePath: string; createdAt: Date }>> {
  const rows = await db
    .select({
      proofId: paymentProofs.id,
      teamId: teams.id,
      teamName: teams.name,
      filePath: paymentProofs.filePath,
      createdAt: paymentProofs.createdAt,
    })
    .from(paymentProofs)
    .innerJoin(teams, eq(paymentProofs.teamId, teams.id))
    .where(eq(paymentProofs.status, "pending"))
    .orderBy(asc(paymentProofs.createdAt));

  return rows;
}

export async function decidePayment(
  db: Db,
  input: {
    proofId: string;
    staffId: string;
    decision: "approved" | "declined";
    note?: string;
    now?: Date;
  },
): Promise<
  | { ok: true; teamName: string; memberEmails: string[] }
  | { ok: false; reason: "not_found" | "already_decided" }
> {
  return await db.transaction(async (tx) => {
    const [existingProof] = await tx
      .select({
        id: paymentProofs.id,
        teamId: paymentProofs.teamId,
        status: paymentProofs.status,
      })
      .from(paymentProofs)
      .where(eq(paymentProofs.id, input.proofId))
      .limit(1);

    if (!existingProof) {
      return { ok: false, reason: "not_found" };
    }

    const now = input.now ?? new Date();

    const [updatedProof] = await tx
      .update(paymentProofs)
      .set({
        status: input.decision,
        reviewedBy: input.staffId,
        reviewedAt: now,
        note: input.note ?? null,
      })
      .where(
        and(
          eq(paymentProofs.id, input.proofId),
          eq(paymentProofs.status, "pending"),
        ),
      )
      .returning();

    if (!updatedProof) {
      return { ok: false, reason: "already_decided" };
    }

    const [team] = await tx
      .update(teams)
      .set({
        paymentStatus: input.decision,
        updatedAt: now,
      })
      .where(eq(teams.id, existingProof.teamId))
      .returning({ name: teams.name });

    await recordAdminAction(tx, {
      staffId: input.staffId,
      action: `payment.${input.decision}`,
      targetType: "payment_proof",
      targetId: input.proofId,
      detail: input.note ? { note: input.note } : undefined,
    });

    const teamMembers = await tx
      .select({ srmEmail: members.srmEmail })
      .from(members)
      .where(eq(members.teamId, existingProof.teamId))
      .orderBy(asc(members.position));

    return {
      ok: true,
      teamName: team?.name ?? "",
      memberEmails: teamMembers.map((m) => m.srmEmail),
    };
  });
}

export async function listSubmissions(
  db: Db,
): Promise<
  Array<{
    submissionId: string;
    teamId: string;
    teamName: string;
    track: string;
    repoUrl: string | null;
    demoUrl: string | null;
    notes: string | null;
    score: number | null;
    reviewNote: string | null;
    shortlistStatus: string;
    updatedAt: Date;
  }>
> {
  const rows = await db
    .select({
      submissionId: submissions.id,
      teamId: teams.id,
      teamName: teams.name,
      track: teams.track,
      repoUrl: submissions.repoUrl,
      demoUrl: submissions.demoUrl,
      notes: submissions.notes,
      score: submissions.score,
      reviewNote: submissions.reviewNote,
      shortlistStatus: teams.shortlistStatus,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .innerJoin(teams, eq(submissions.teamId, teams.id))
    .where(eq(submissions.episode, 0))
    .orderBy(
      sql`${submissions.score} desc nulls last`,
      desc(submissions.updatedAt),
    );

  return rows;
}

export async function reviewSubmission(
  db: Db,
  input: {
    submissionId: string;
    staffId: string;
    score: number;
    reviewNote: string;
  },
): Promise<{ ok: boolean }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: submissions.id, teamId: submissions.teamId })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1);

    if (!existing) {
      return { ok: false };
    }

    const now = new Date();

    await tx
      .update(submissions)
      .set({
        score: input.score,
        reviewNote: input.reviewNote,
        updatedAt: now,
      })
      .where(eq(submissions.id, input.submissionId));

    await recordAdminAction(tx, {
      staffId: input.staffId,
      action: "submission.reviewed",
      targetType: "submission",
      targetId: input.submissionId,
      detail: {
        score: input.score,
        reviewNote: input.reviewNote,
      },
    });

    return { ok: true };
  });
}

export async function setShortlistStatus(
  db: Db,
  input: {
    teamId: string;
    staffId: string;
    status: "pending" | "shortlisted" | "not_shortlisted";
  },
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: teams.id, shortlistStatus: teams.shortlistStatus })
      .from(teams)
      .where(eq(teams.id, input.teamId))
      .limit(1);

    if (!existing) {
      return { ok: false, reason: "not_found" };
    }

    const now = new Date();

    await tx
      .update(teams)
      .set({
        shortlistStatus: input.status,
        updatedAt: now,
      })
      .where(eq(teams.id, input.teamId));

    await recordAdminAction(tx, {
      staffId: input.staffId,
      action: "team.shortlist",
      targetType: "team",
      targetId: input.teamId,
      detail: {
        from: existing.shortlistStatus,
        to: input.status,
      },
    });

    return { ok: true };
  });
}
