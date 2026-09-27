// Flow A, registration (Harsh): queries for this flow. Only this flow's owner edits this file.
// Plan: docs/superpowers/plans/2026-09-26-flow-registration.md

import { eq, inArray, or } from "drizzle-orm";
import type { Registration } from "@pandora/core";
import { teamNameKey } from "@pandora/core";
import type { Db } from "../client";
import { members, paymentProofs, teams } from "../schema";
import { uniqueViolationField, type UniqueField } from "../errors";
import { claimVerifiedOtp } from "./auth";

export type RegisterTeamInput = {
  teamId: string;
  registration: Registration;
  paymentEnabled: boolean;
  photoPaths?: Array<string | null>;
  paymentProofPath?: string | null;
  now?: Date;
};

export type RegisterTeamResult =
  | { ok: true; teamId: string }
  | { ok: false; reason: "email_not_verified" }
  | { ok: false; reason: "taken"; field: UniqueField };

export async function registerTeam(
  db: Db,
  input: RegisterTeamInput,
): Promise<RegisterTeamResult> {
  const {
    teamId,
    registration,
    paymentEnabled,
    photoPaths,
    paymentProofPath,
    now,
  } = input;

  try {
    return await db.transaction(async (tx) => {
      const verified = await claimVerifiedOtp(tx, {
        email: registration.members[0]!.srmEmail,
        purpose: "registration",
        ...(now ? { now } : {}),
      });

      if (!verified) {
        return {
          ok: false,
          reason: "email_not_verified",
        } as const;
      }

      await tx.insert(teams).values({
        id: teamId,
        name: registration.teamName,
        nameKey: teamNameKey(registration.teamName),
        track: registration.track,
        paymentStatus: paymentEnabled ? "pending" : "not_required",
        ...(now ? { createdAt: now, updatedAt: now } : {}),
      });

      await tx.insert(members).values(
        registration.members.map((member, index) => ({
          teamId,
          position: index + 1,
          isLeader: index === 0,
          firstName: member.firstName,
          lastName: member.lastName,
          regNumber: member.regNumber,
          srmEmail: member.srmEmail,
          personalEmail: member.personalEmail,
          phone: member.phone,
          photoPath: photoPaths?.[index] ?? null,
          ...(now ? { createdAt: now, updatedAt: now } : {}),
        })),
      );

      if (paymentProofPath) {
        await tx.insert(paymentProofs).values({
          teamId,
          filePath: paymentProofPath,
          ...(now ? { createdAt: now } : {}),
        });
      }

      return {
        ok: true,
        teamId,
      } as const;
    });
  } catch (error) {
    const field = uniqueViolationField(error);

    if (field) {
      return {
        ok: false,
        reason: "taken",
        field,
      };
    }

    throw error;
  }
}

export async function isTeamNameAvailable(
  db: Db,
  name: string,
): Promise<boolean> {
  const nameKey = teamNameKey(name);

  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.nameKey, nameKey))
    .limit(1);

  return existing.length === 0;
}

export async function findTakenMemberFields(
  db: Db,
  membersToCheck: Array<{ regNumber: string; srmEmail: string }>,
): Promise<Array<{ index: number; field: "regNumber" | "srmEmail" }>> {
  if (membersToCheck.length === 0) {
    return [];
  }

  const regNumbers = membersToCheck.map((member) => member.regNumber);
  const srmEmails = membersToCheck.map((member) => member.srmEmail);

  const existing = await db
    .select({
      regNumber: members.regNumber,
      srmEmail: members.srmEmail,
    })
    .from(members)
    .where(
      or(
        inArray(members.regNumber, regNumbers),
        inArray(members.srmEmail, srmEmails),
      ),
    );

  const takenRegNumbers = new Set(
    existing.map((member) => member.regNumber),
  );
  const takenEmails = new Set(existing.map((member) => member.srmEmail));

  const result: Array<{
    index: number;
    field: "regNumber" | "srmEmail";
  }> = [];

  membersToCheck.forEach((member, index) => {
    if (takenRegNumbers.has(member.regNumber)) {
      result.push({ index, field: "regNumber" });
    }

    if (takenEmails.has(member.srmEmail)) {
      result.push({ index, field: "srmEmail" });
    }
  });

  return result;
}
