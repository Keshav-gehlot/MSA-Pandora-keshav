import "server-only";
import { createSession, getMemberWithTeam, getSession, revokeSession } from "@pandora/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./cf-db";

const COOKIE = "pandora_session";

export async function startMemberSession(memberId: string): Promise<void> {
  const { token, expiresAt } = await createSession(await getDb(), { subjectType: "member", subjectId: memberId });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentMemberId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await getSession(await getDb(), token);
  return session?.subjectType === "member" ? session.subjectId : null;
}

export type SignedInMember = NonNullable<Awaited<ReturnType<typeof getMemberWithTeam>>>;

// Use at the top of every signed-in page and server action. Returns the member and their team, or redirects to
// sign-in when there's no session or the member no longer exists.
export async function requireMember(): Promise<SignedInMember> {
  const id = await currentMemberId();
  if (!id) redirect("/?signin=1");
  const found = await getMemberWithTeam(await getDb(), id);
  if (!found) redirect("/?signin=1");
  return found;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeSession(await getDb(), token);
  jar.delete(COOKIE);
}
