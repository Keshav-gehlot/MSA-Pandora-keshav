"use server";

import { parsePassPayload } from "@pandora/core";
import { attendanceSummary, checkIn, getStorage, lookupPass, searchCheckin } from "@pandora/db";
import { getDb } from "../../lib/cf-db";
import { requireStaff } from "../../lib/session";

export type AttendeeDetails = {
  memberId: string;
  memberName: string;
  regNumber: string;
  photoUrl: string | null;
  teamName: string;
  track: string;
  checkedIn: { at: Date; byName: string } | null;
};

export type LookupScanResult =
  | { ok: true; data: AttendeeDetails }
  | { ok: false; error: string };

export type CheckInResult =
  | { ok: true; at: Date }
  | { ok: false; error: string; already?: boolean };

export type SearchMemberResult = {
  memberId: string;
  memberName: string;
  regNumber: string;
  teamName: string;
  hasPass: boolean;
  checkedInAt: Date | null;
};

function formatIstTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * Validates and looks up an attendee by their scanned QR pass payload.
 * Expected payload: "pandora-pass:<token>"
 */
export async function lookupScan(payload: string): Promise<LookupScanResult> {
  await requireStaff();

  const token = parsePassPayload(payload);
  if (!token) {
    return { ok: false, error: "This isn't a valid Pandora pass." };
  }

  const db = await getDb();
  const pass = await lookupPass(db, token);
  if (!pass) {
    return { ok: false, error: "This isn't a valid Pandora pass." };
  }

  if (pass.revoked) {
    return { ok: false, error: "This pass was cancelled." };
  }

  let photoUrl: string | null = null;
  if (pass.photoPath) {
    try {
      const storage = getStorage();
      photoUrl = await storage.signedUrl(pass.photoPath);
    } catch {
      photoUrl = null;
    }
  }

  return {
    ok: true,
    data: {
      memberId: pass.memberId,
      memberName: pass.memberName,
      regNumber: pass.regNumber,
      photoUrl,
      teamName: pass.teamName,
      track: pass.track,
      checkedIn: pass.checkedIn,
    },
  };
}

/**
 * Confirms check-in for an attendee by memberId.
 * Authenticates that the caller is staff/admin.
 */
export async function confirmCheckIn(memberId: string): Promise<CheckInResult> {
  const staff = await requireStaff();
  const db = await getDb();

  const result = await checkIn(db, {
    memberId,
    staffId: staff.id,
  });

  if (result.ok) {
    return { ok: true, at: result.at };
  }

  if (result.reason === "already") {
    const timeStr = formatIstTime(new Date(result.at));
    return {
      ok: false,
      already: true,
      error: `Already checked in at ${timeStr} by ${result.byName}.`,
    };
  }

  if (result.reason === "revoked") {
    return { ok: false, error: "This pass was cancelled." };
  }

  return { ok: false, error: "This member does not have an active pass." };
}

/**
 * Searches attendees by query (name, reg number, team).
 * Authenticates that the caller is staff/admin.
 */
export async function searchMembers(
  query: string,
): Promise<{ ok: true; data: SearchMemberResult[] } | { ok: false; error: string }> {
  await requireStaff();
  const db = await getDb();
  const results = await searchCheckin(db, query);
  return { ok: true, data: results };
}

export type TeamAttendance = {
  teamId: string;
  teamName: string;
  expected: number;
  present: number;
};

/**
 * Retrieves event attendance metrics by team.
 * Authenticates that the caller is staff/admin.
 */
export async function getAttendanceSummaryAction(): Promise<{
  ok: true;
  data: TeamAttendance[];
}> {
  await requireStaff();
  const db = await getDb();
  const rows = await attendanceSummary(db);
  return { ok: true, data: rows };
}
