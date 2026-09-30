"use server";

import { decisionNoteSchema, type FieldChange } from "@pandora/core";
import { decideEditRequest, listPendingEditRequests } from "@pandora/db";
import { sendEmail } from "@pandora/email";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/cf-db";
import { requireStaff } from "../../../lib/session";

export type PendingEditItem = {
  requestId: string;
  teamId: string;
  teamName: string;
  requestedByName: string;
  changes: FieldChange[];
  createdAt: Date;
};

export async function fetchPendingEdits(): Promise<PendingEditItem[]> {
  await requireStaff("admin");
  const db = await getDb();
  return await listPendingEditRequests(db);
}

export async function reviewEditRequest(
  requestId: string,
  decision: "approved" | "declined",
  note?: string,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const admin = await requireStaff("admin");

  let trimmedNote: string | undefined;
  if (note !== undefined && note.trim() !== "") {
    const parsed = decisionNoteSchema.safeParse(note.trim());
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid note" };
    }
    trimmedNote = parsed.data;
  }

  const db = await getDb();
  const result = await decideEditRequest(db, {
    requestId,
    staffId: admin.id,
    decision,
    note: trimmedNote,
  });

  if (!result.ok) {
    if (result.reason === "already_decided") {
      revalidatePath("/edits");
      return { ok: false, message: "This edit request has already been reviewed" };
    }
    if (result.reason === "not_found") {
      return { ok: false, message: "Edit request not found" };
    }
    if (result.reason === "invalid") {
      return { ok: false, message: result.message };
    }
    if (result.reason === "taken") {
      const fieldLabel =
        result.field === "teamName"
          ? "Team name"
          : result.field === "regNumber"
            ? "Registration number"
            : "SRM email";
      return { ok: false, message: `${fieldLabel} is already taken by another team` };
    }
    return { ok: false, message: "Failed to process edit request" };
  }

  let warning: string | undefined;
  const { teamName, memberEmails } = result;

  const emailResults = await Promise.allSettled(
    memberEmails.map((to) =>
      sendEmail({
        to,
        template: "admin-edit-decided",
        props: {
          teamName,
          approved: decision === "approved",
          note: trimmedNote ?? null,
        },
      }),
    ),
  );

  const failedCount = emailResults.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
  ).length;

  if (failedCount > 0) {
    warning = `Edit request ${decision}, but could not send email to ${failedCount} of ${memberEmails.length} member(s)`;
  }

  revalidatePath("/edits");
  return { ok: true, warning };
}
