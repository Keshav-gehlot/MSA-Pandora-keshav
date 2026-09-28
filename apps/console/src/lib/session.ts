import "server-only";
import { createSession, getSession, getStaffById, revokeSession } from "@pandora/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./cf-db";

const COOKIE = "pandora_console_session";

export async function startStaffSession(staffId: string): Promise<void> {
  const { token, expiresAt } = await createSession(await getDb(), { subjectType: "staff", subjectId: staffId });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentStaffId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(await getDb(), token);
  return session?.subjectType === "staff" ? session.subjectId : null;
}

export type SignedInStaff = NonNullable<Awaited<ReturnType<typeof getStaffById>>>;

// Use at the top of every console page and server action. Returns the staff row, or redirects to sign-in when
// there's no session or the row no longer exists. Pass "admin" on admin-only pages: staff are sent to "/".
export async function requireStaff(role?: "admin"): Promise<SignedInStaff> {
  const id = await currentStaffId();
  if (!id) redirect("/sign-in");
  const row = await getStaffById(await getDb(), id);
  if (!row) redirect("/sign-in");
  if (role === "admin" && row.role !== "admin") redirect("/");
  return row;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeSession(await getDb(), token);
  jar.delete(COOKIE);
}
