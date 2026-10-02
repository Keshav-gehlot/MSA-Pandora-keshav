"use server";

import { reviewSchema, siteConfig } from "@pandora/core";
import {
  getTeamDetail,
  issuePassesForTeam,
  listSubmissions,
  reviewSubmission,
  setShortlistStatus,
} from "@pandora/db";
import { sendEmail } from "@pandora/email";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/cf-db";
import { requireStaff } from "../../../lib/session";

export type SubmissionItem = {
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
};

export async function fetchSubmissions(): Promise<SubmissionItem[]> {
  await requireStaff("admin");
  const db = await getDb();
  return await listSubmissions(db);
}

export async function submitReviewAction(
  submissionId: string,
  score: number | string,
  reviewNote: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = await requireStaff("admin");

  const parsed = reviewSchema.safeParse({
    score,
    reviewNote,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid review input",
    };
  }

  const db = await getDb();
  const result = await reviewSubmission(db, {
    submissionId,
    staffId: admin.id,
    score: parsed.data.score,
    reviewNote: parsed.data.reviewNote,
  });

  if (!result.ok) {
    return { ok: false, message: "Submission not found" };
  }

  revalidatePath("/episode-0");
  return { ok: true };
}

type EmailMember = { firstName: string; srmEmail: string };

/** Sends the pass-ready email to every member and returns how many sends failed. */
async function sendPassReadyEmails(teamName: string, teamMembers: EmailMember[]): Promise<number> {
  const results = await Promise.allSettled(
    teamMembers.map((member) =>
      sendEmail({
        to: member.srmEmail,
        template: "checkin-pass-ready",
        props: {
          firstName: member.firstName,
          teamName,
          dashboardUrl: `${siteConfig.urls.web}/team`,
        },
      }),
    ),
  );
  return results.filter((email) => email.status === "rejected" || (email.status === "fulfilled" && !email.value.ok))
    .length;
}

const VALID_STATUSES = ["pending", "shortlisted", "not_shortlisted"] as const;

export async function updateShortlistAction(
  teamId: string,
  status: "pending" | "shortlisted" | "not_shortlisted",
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const admin = await requireStaff("admin");

  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, message: "Invalid shortlist status" };
  }

  const db = await getDb();
  const result = await setShortlistStatus(db, {
    teamId,
    staffId: admin.id,
    status,
  });

  if (!result.ok) {
    return { ok: false, message: "Team not found" };
  }

  let warning: string | undefined;
  if (status === "shortlisted") {
    const secret = process.env.PASS_SECRET;
    if (!secret) {
      warning = "Team shortlisted, but event passes could not be issued because PASS_SECRET is not configured";
    } else {
      try {
        const passes = await issuePassesForTeam(db, { teamId, secret });
        if (!passes.ok) {
          warning = "Team shortlisted, but event passes could not be issued; shortlist again to retry";
        } else if (passes.issued > 0) {
          const detail = await getTeamDetail(db, teamId);
          if (!detail) {
            warning = "Team shortlisted and passes issued, but member emails could not be prepared. Use \"Resend pass email\" to retry";
          } else {
            const failedCount = await sendPassReadyEmails(detail.team.name, detail.members);
            if (failedCount > 0) {
              warning = `Team shortlisted and passes issued, but could not send email to ${failedCount} of ${detail.members.length} member(s). Use "Resend pass email" to retry`;
            }
          }
        }
      } catch (error) {
        // Name only: the message could carry connection details or the pass secret.
        console.error("Issuing event passes failed", error instanceof Error ? error.name : "unknown error");
        warning = "Team shortlisted, but event passes could not be issued; shortlist again to retry";
      }
    }
  }

  revalidatePath("/episode-0");
  return { ok: true, warning };
}

/** Emails the pass-ready message again to a shortlisted team, without issuing anything new. */
export async function resendPassEmailAction(
  teamId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireStaff("admin");
  const db = await getDb();

  const detail = await getTeamDetail(db, teamId);
  if (!detail) {
    return { ok: false, message: "Team not found" };
  }
  if (detail.team.shortlistStatus !== "shortlisted") {
    return { ok: false, message: "Only shortlisted teams have event passes" };
  }

  const failedCount = await sendPassReadyEmails(detail.team.name, detail.members);
  if (failedCount > 0) {
    return { ok: false, message: `Could not send email to ${failedCount} of ${detail.members.length} member(s)` };
  }
  return { ok: true };
}
