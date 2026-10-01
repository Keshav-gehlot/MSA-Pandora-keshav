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
            warning = "Team shortlisted and passes issued, but member emails could not be prepared";
          } else {
            const emailResults = await Promise.allSettled(
              detail.members.map((member) =>
                sendEmail({
                  to: member.srmEmail,
                  template: "checkin-pass-ready",
                  props: {
                    firstName: member.firstName,
                    teamName: detail.team.name,
                    dashboardUrl: `${siteConfig.urls.web}/team`,
                  },
                }),
              ),
            );
            const failedCount = emailResults.filter(
              (email) => email.status === "rejected" || (email.status === "fulfilled" && !email.value.ok),
            ).length;
            if (failedCount > 0) {
              warning = `Team shortlisted and passes issued, but could not send email to ${failedCount} of ${detail.members.length} member(s)`;
            }
          }
        }
      } catch {
        warning = "Team shortlisted, but event passes could not be issued; shortlist again to retry";
      }
    }
  }

  revalidatePath("/episode-0");
  return { ok: true, warning };
}
