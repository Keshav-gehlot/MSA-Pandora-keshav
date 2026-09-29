"use server";

import { decisionNoteSchema } from "@pandora/core";
import { decidePayment, getStorage, listPendingPayments } from "@pandora/db";
import { sendEmail } from "@pandora/email";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/cf-db";
import { requireStaff } from "../../../lib/session";

export type PendingPaymentItem = {
  proofId: string;
  teamId: string;
  teamName: string;
  filePath: string;
  signedUrl: string | null;
  createdAt: Date;
};

export async function fetchPendingPayments(): Promise<PendingPaymentItem[]> {
  await requireStaff("admin");
  const db = await getDb();
  const rows = await listPendingPayments(db);
  const storage = getStorage();

  return await Promise.all(
    rows.map(async (row) => {
      let signedUrl: string | null = null;
      try {
        signedUrl = await storage.signedUrl(row.filePath, 300);
      } catch {
        signedUrl = null;
      }
      return {
        ...row,
        signedUrl,
      };
    }),
  );
}

export async function reviewPayment(
  proofId: string,
  decision: "approved" | "declined",
  note?: string,
): Promise<{ ok: true; warning?: string } | { ok: false; message: string }> {
  const admin = await requireStaff("admin");

  let trimmedNote: string | undefined;
  if (decision === "declined") {
    trimmedNote = (note ?? "").trim();
    if (!trimmedNote) {
      return { ok: false, message: "A note is required when declining a payment" };
    }
    const parsed = decisionNoteSchema.safeParse(trimmedNote);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid note" };
    }
    trimmedNote = parsed.data;
  }

  const db = await getDb();
  const result = await decidePayment(db, {
    proofId,
    staffId: admin.id,
    decision,
    note: trimmedNote,
  });

  if (!result.ok) {
    if (result.reason === "already_decided") {
      revalidatePath("/payments");
      return { ok: false, message: "This payment has already been reviewed" };
    }
    return { ok: false, message: "Payment proof not found" };
  }

  let warning: string | undefined;
  const { teamName, memberEmails } = result;

  const emailResults = await Promise.allSettled(
    memberEmails.map((to) => {
      if (decision === "approved") {
        return sendEmail({
          to,
          template: "admin-payment-approved",
          props: { teamName },
        });
      } else {
        return sendEmail({
          to,
          template: "admin-payment-declined",
          props: { teamName, note: trimmedNote },
        });
      }
    }),
  );

  const failedCount = emailResults.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
  ).length;

  if (failedCount > 0) {
    warning = `Payment ${decision}, but could not send email to ${failedCount} of ${memberEmails.length} member(s)`;
  }

  revalidatePath("/payments");
  return { ok: true, warning };
}
