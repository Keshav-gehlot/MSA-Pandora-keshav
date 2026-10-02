import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  applyChanges,
  teamEditSchema,
  teamNameKey,
  type FieldChange,
  type TeamSnapshot,
} from "@pandora/core";
import type { Db } from "../client";
import { uniqueViolationField, type UniqueField } from "../errors";
import {
  adminActions,
  editRequests,
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

/** The most recent notices shown on the console; older ones stay in the database. */
const NOTIFICATION_LIST_LIMIT = 100;

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
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(NOTIFICATION_LIST_LIMIT);
}

export async function noticeTeamExists(db: Db, teamId: string): Promise<boolean> {
  const [row] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  return row !== undefined;
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

async function loadTeamSnapshot(
  db: Db,
  teamId: string,
): Promise<TeamSnapshot | null> {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      track: teams.track,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return null;

  const rows = await db
    .select({
      id: members.id,
      firstName: members.firstName,
      lastName: members.lastName,
      regNumber: members.regNumber,
      srmEmail: members.srmEmail,
      personalEmail: members.personalEmail,
      phone: members.phone,
    })
    .from(members)
    .where(eq(members.teamId, teamId))
    .orderBy(asc(members.position));

  return {
    teamName: team.name,
    track: team.track as TeamSnapshot["track"],
    members: rows,
  };
}

export async function listPendingEditRequests(
  db: Db,
): Promise<
  Array<{
    requestId: string;
    teamId: string;
    teamName: string;
    requestedByName: string;
    changes: FieldChange[];
    createdAt: Date;
  }>
> {
  const rows = await db
    .select({
      requestId: editRequests.id,
      teamId: teams.id,
      teamName: teams.name,
      firstName: members.firstName,
      lastName: members.lastName,
      changes: editRequests.changes,
      createdAt: editRequests.createdAt,
    })
    .from(editRequests)
    .innerJoin(teams, eq(editRequests.teamId, teams.id))
    .innerJoin(members, eq(editRequests.requestedBy, members.id))
    .where(eq(editRequests.status, "pending"))
    .orderBy(asc(editRequests.createdAt));

  return rows.map((r) => ({
    requestId: r.requestId,
    teamId: r.teamId,
    teamName: r.teamName,
    requestedByName: `${r.firstName} ${r.lastName}`.trim(),
    changes: r.changes,
    createdAt: r.createdAt,
  }));
}

export async function decideEditRequest(
  db: Db,
  input: {
    requestId: string;
    staffId: string;
    decision: "approved" | "declined";
    note?: string;
    now?: Date;
  },
): Promise<
  | { ok: true; teamName: string; memberEmails: string[] }
  | { ok: false; reason: "not_found" | "already_decided" }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "taken"; field: UniqueField }
> {
  try {
    return await db.transaction(async (tx) => {
      const [existingRequest] = await tx
        .select({
          id: editRequests.id,
          teamId: editRequests.teamId,
          status: editRequests.status,
          changes: editRequests.changes,
        })
        .from(editRequests)
        .where(eq(editRequests.id, input.requestId))
        .limit(1);

      if (!existingRequest) {
        return { ok: false, reason: "not_found" };
      }

      if (existingRequest.status !== "pending") {
        return { ok: false, reason: "already_decided" };
      }

      const now = input.now ?? new Date();

      if (input.decision === "declined") {
        const [updatedRequest] = await tx
          .update(editRequests)
          .set({
            status: "declined",
            reviewedBy: input.staffId,
            reviewedAt: now,
            note: input.note ?? null,
          })
          .where(
            and(
              eq(editRequests.id, input.requestId),
              eq(editRequests.status, "pending"),
            ),
          )
          .returning();

        if (!updatedRequest) {
          return { ok: false, reason: "already_decided" };
        }

        const [team] = await tx
          .select({ name: teams.name })
          .from(teams)
          .where(eq(teams.id, existingRequest.teamId))
          .limit(1);

        await tx.insert(notifications).values({
          teamId: existingRequest.teamId,
          title: "Your change request was declined",
          body: input.note?.trim() || "Your change request was declined.",
          createdBy: input.staffId,
          createdAt: now,
        });

        await recordAdminAction(tx, {
          staffId: input.staffId,
          action: "edit.declined",
          targetType: "edit_request",
          targetId: input.requestId,
          detail: input.note ? { note: input.note } : undefined,
        });

        const teamMembers = await tx
          .select({ srmEmail: members.srmEmail })
          .from(members)
          .where(eq(members.teamId, existingRequest.teamId))
          .orderBy(asc(members.position));

        return {
          ok: true,
          teamName: team?.name ?? "",
          memberEmails: teamMembers.map((m) => m.srmEmail),
        };
      }

      const snapshot = await loadTeamSnapshot(tx as unknown as Db, existingRequest.teamId);
      if (!snapshot) {
        return { ok: false, reason: "not_found" };
      }

      let nextSnapshot: TeamSnapshot;
      try {
        nextSnapshot = applyChanges(snapshot, existingRequest.changes);
      } catch (err) {
        return {
          ok: false,
          reason: "invalid",
          message: err instanceof Error ? err.message : "Invalid edit",
        };
      }

      const validation = teamEditSchema.safeParse(nextSnapshot);
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        return {
          ok: false,
          reason: "invalid",
          message: firstIssue?.message ?? "Invalid edit",
        };
      }

      const validSnapshot = validation.data;

      const [updatedRequest] = await tx
        .update(editRequests)
        .set({
          status: "approved",
          reviewedBy: input.staffId,
          reviewedAt: now,
          note: input.note ?? null,
        })
        .where(
          and(
            eq(editRequests.id, input.requestId),
            eq(editRequests.status, "pending"),
          ),
        )
        .returning();

      if (!updatedRequest) {
        return { ok: false, reason: "already_decided" };
      }

      for (const change of existingRequest.changes) {
        if (change.path === "teamName") {
          await tx
            .update(teams)
            .set({
              name: change.to,
              nameKey: teamNameKey(change.to),
              updatedAt: now,
            })
            .where(eq(teams.id, existingRequest.teamId));
        } else if (change.path === "track") {
          await tx
            .update(teams)
            .set({
              track: change.to,
              updatedAt: now,
            })
            .where(eq(teams.id, existingRequest.teamId));
        } else if (change.path.startsWith("members.")) {
          const [, memberId, field] = change.path.split(".");
          if (memberId && field) {
            await tx
              .update(members)
              .set({
                [field]: change.to,
                updatedAt: now,
              })
              .where(eq(members.id, memberId));
          }
        }
      }

      await tx.insert(notifications).values({
        teamId: existingRequest.teamId,
        title: "Your change request was approved",
        body: input.note?.trim() || "Your change request was approved.",
        createdBy: input.staffId,
        createdAt: now,
      });

      await recordAdminAction(tx, {
        staffId: input.staffId,
        action: "edit.approved",
        targetType: "edit_request",
        targetId: input.requestId,
        detail: input.note ? { note: input.note } : undefined,
      });

      const teamMembers = await tx
        .select({ srmEmail: members.srmEmail })
        .from(members)
        .where(eq(members.teamId, existingRequest.teamId))
        .orderBy(asc(members.position));

      return {
        ok: true,
        teamName: validSnapshot.teamName,
        memberEmails: teamMembers.map((m) => m.srmEmail),
      };
    });
  } catch (error) {
    const field = uniqueViolationField(error);
    if (field) {
      return { ok: false, reason: "taken", field };
    }
    throw error;
  }
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
