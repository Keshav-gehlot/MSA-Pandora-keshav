import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../client";
import { adminActions, members, paymentProofs, teams } from "../schema";

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
