"use server";

import { submissionSchema, teamEditSchema, type Submission } from "@pandora/core";
import { getTeamSnapshot, markNotificationRead, proposeEdit, saveSubmission } from "@pandora/db";
import { revalidatePath } from "next/cache";
import { getDb } from "../../lib/cf-db";
import { requireMember } from "../../lib/session";
import { buildProposedSnapshot, fieldKeyFromPath } from "./edit-form";

export type ActionResult = { ok: true } | { ok: false; message: string; fieldErrors?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function markRead(notificationId: string): Promise<ActionResult> {
  const { member, team } = await requireMember();
  if (typeof notificationId !== "string" || !UUID.test(notificationId)) {
    return { ok: false, message: "That notice doesn't exist." };
  }

  try {
    await markNotificationRead(await getDb(), { notificationId, memberId: member.id, teamId: team.id });
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidatePath("/team");
  return { ok: true };
}

export async function submitEdit(formData: FormData): Promise<ActionResult> {
  const { member, team } = await requireMember();

  try {
    const db = await getDb();
    const current = await getTeamSnapshot(db, team.id);
    if (!current) return { ok: false, message: GENERIC_ERROR };

    const proposed = buildProposedSnapshot(current, formData);
    const parsed = teamEditSchema.safeParse(proposed);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = fieldKeyFromPath(issue.path, proposed);
        if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
      }
      return { ok: false, message: "Check the highlighted fields.", fieldErrors };
    }

    const result = await proposeEdit(db, { teamId: team.id, memberId: member.id, proposed: parsed.data });
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "no_changes"
            ? "You haven't changed anything."
            : "You already have a change waiting for review.",
      };
    }
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function submitEpisodeZero(formData: FormData): Promise<ActionResult> {
  const { team } = await requireMember();

  const read = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const parsed = submissionSchema.safeParse({ repoUrl: read("repoUrl"), demoUrl: read("demoUrl"), notes: read("notes") });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }

  try {
    const submission: Submission = parsed.data;
    const result = await saveSubmission(await getDb(), {
      teamId: team.id,
      submission,
      deadline: process.env.EPISODE_0_DEADLINE,
    });
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "closed"
            ? "Episode 0 is closed."
            : "Your team needs to be verified before you can submit. An admin approves your payment first.",
      };
    }
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/team");
  return { ok: true };
}
