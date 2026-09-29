"use server";

import { notificationSchema } from "@pandora/core";
import { createNotification, listNoticeTeams } from "@pandora/db";
import { revalidatePath } from "next/cache";
import { getDb } from "../../../lib/cf-db";
import { requireStaff } from "../../../lib/session";

export type SendNoticeResult = { ok: true } | { ok: false; message: string };

export async function sendNotice(input: {
  title: string;
  body: string;
  teamId: string | null;
}): Promise<SendNoticeResult> {
  const admin = await requireStaff("admin");
  const parsed = notificationSchema.safeParse({ title: input.title, body: input.body });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid notice" };
  }

  const teamId = input.teamId?.trim() || null;
  const db = await getDb();

  if (teamId) {
    const teams = await listNoticeTeams(db);
    if (!teams.some((team) => team.id === teamId)) {
      return { ok: false, message: "Choose a valid team" };
    }
  }

  await createNotification(db, {
    staffId: admin.id,
    teamId,
    ...parsed.data,
  });

  revalidatePath("/notices");
  return { ok: true };
}
