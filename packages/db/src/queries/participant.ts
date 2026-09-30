import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import {
  diffTeam,
  isEpisodeZeroOpen,
  type FieldChange,
  type Submission,
  type TeamSnapshot,
} from "@pandora/core";
import type { Db } from "../client";
import {
  editRequests,
  members,
  notificationReads,
  notifications,
  submissions,
  teams,
} from "../schema";

export async function getTeamSnapshot(
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

export type Dashboard = {
  team: {
    id: string;
    name: string;
    track: string;
    paymentStatus: string;
    shortlistStatus: string;
  };
  members: Array<{
    id: string;
    position: number;
    isLeader: boolean;
    firstName: string;
    lastName: string;
    srmEmail: string;
  }>;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: Date;
    read: boolean;
  }>;
  unreadCount: number;
  submission: {
    repoUrl: string | null;
    demoUrl: string | null;
    notes: string | null;
    updatedAt: Date;
  } | null;
  pendingEdit: {
    id: string;
    changes: FieldChange[];
    createdAt: Date;
  } | null;
};

export async function getDashboard(
  db: Db,
  input: { teamId: string; memberId: string },
): Promise<Dashboard> {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      track: teams.track,
      paymentStatus: teams.paymentStatus,
      shortlistStatus: teams.shortlistStatus,
    })
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .limit(1);

  if (!team) {
    throw new Error("Team not found");
  }

  const teamMembers = await db
    .select({
      id: members.id,
      position: members.position,
      isLeader: members.isLeader,
      firstName: members.firstName,
      lastName: members.lastName,
      srmEmail: members.srmEmail,
    })
    .from(members)
    .where(eq(members.teamId, input.teamId))
    .orderBy(asc(members.position));

  const notices = await db
    .select()
    .from(notifications)
    .where(
      or(
        eq(notifications.teamId, input.teamId),
        isNull(notifications.teamId),
      ),
    )
    .orderBy(desc(notifications.createdAt));

  const reads = await db
    .select({
      notificationId: notificationReads.notificationId,
    })
    .from(notificationReads)
    .where(eq(notificationReads.memberId, input.memberId));

  const read = new Set(reads.map((r) => r.notificationId));

  const submissionRows = await db
    .select({
      repoUrl: submissions.repoUrl,
      demoUrl: submissions.demoUrl,
      notes: submissions.notes,
      updatedAt: submissions.updatedAt,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.teamId, input.teamId),
        eq(submissions.episode, 0),
      ),
    )
    .limit(1);

  const pendingRows = await db
    .select({
      id: editRequests.id,
      changes: editRequests.changes,
      createdAt: editRequests.createdAt,
    })
    .from(editRequests)
    .where(
      and(
        eq(editRequests.teamId, input.teamId),
        eq(editRequests.status, "pending"),
      ),
    )
    .limit(1);

  return {
    team,
    members: teamMembers,
    notifications: notices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      createdAt: n.createdAt,
      read: read.has(n.id),
    })),
    unreadCount: notices.filter((n) => !read.has(n.id)).length,
    submission: submissionRows[0] ?? null,
    pendingEdit: pendingRows[0]
      ? {
          ...pendingRows[0],
          changes: pendingRows[0].changes as FieldChange[],
        }
      : null,
  };
}

export async function markNotificationRead(
  db: Db,
  input: { notificationId: string; memberId: string; teamId: string },
): Promise<void> {
  const [notification] = await db
    .select({
      id: notifications.id,
      teamId: notifications.teamId,
    })
    .from(notifications)
    .where(eq(notifications.id, input.notificationId))
    .limit(1);

  if (!notification) {
    return;
  }

  const visible =
    notification.teamId === null ||
    notification.teamId === input.teamId;

  if (!visible) {
    return;
  }

  await db
    .insert(notificationReads)
    .values({
      notificationId: input.notificationId,
      memberId: input.memberId,
    })
    .onConflictDoNothing();
}

export async function proposeEdit(
  db: Db,
  input: {
    teamId: string;
    memberId: string;
    proposed: TeamSnapshot;
  },
): Promise<
  | { ok: true; changes: FieldChange[] }
  | { ok: false; reason: "no_changes" | "pending_exists" }
> {
  const current = await getTeamSnapshot(db, input.teamId);

  if (!current) {
    throw new Error("Team not found");
  }

  const changes = diffTeam(current, input.proposed);

  if (changes.length === 0) {
    return {
      ok: false,
      reason: "no_changes",
    };
  }

  const [pending] = await db
    .select({
      id: editRequests.id,
    })
    .from(editRequests)
    .where(
      and(
        eq(editRequests.teamId, input.teamId),
        eq(editRequests.status, "pending"),
      ),
    )
    .limit(1);

  if (pending) {
    return {
      ok: false,
      reason: "pending_exists",
    };
  }

  await db.insert(editRequests).values({
    teamId: input.teamId,
    requestedBy: input.memberId,
    changes,
  });

  return {
    ok: true,
    changes,
  };
}

export async function saveSubmission(
  db: Db,
  input: {
    teamId: string;
    submission: Submission;
    now?: Date;
    deadline?: string;
  },
): Promise<{ ok: true } | { ok: false; reason: "closed" | "not_verified" }> {
  const now = input.now ?? new Date();

  if (!isEpisodeZeroOpen(now, input.deadline)) {
    return {
      ok: false,
      reason: "closed",
    };
  }

  // Only verified teams may submit: a team is verified when an admin approved its payment, or when the event has no
  // payment at all ("not_required"). Pending and declined teams cannot submit yet.
  const [team] = await db
    .select({ paymentStatus: teams.paymentStatus })
    .from(teams)
    .where(eq(teams.id, input.teamId));
  if (!team || (team.paymentStatus !== "approved" && team.paymentStatus !== "not_required")) {
    return { ok: false, reason: "not_verified" };
  }

  await db
    .insert(submissions)
    .values({
      teamId: input.teamId,
      episode: 0,
      repoUrl: input.submission.repoUrl,
      demoUrl: input.submission.demoUrl,
      notes: input.submission.notes,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [submissions.teamId, submissions.episode],
      set: {
        repoUrl: input.submission.repoUrl,
        demoUrl: input.submission.demoUrl,
        notes: input.submission.notes,
        updatedAt: now,
      },
    });

  return {
    ok: true,
  };
}
