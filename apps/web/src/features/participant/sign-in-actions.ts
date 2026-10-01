"use server";

import { otpCodeSchema, srmEmailSchema } from "@pandora/core";
import { findMemberByEmail, issueOtp, verifyOtp } from "@pandora/db";
import { sendEmail } from "@pandora/email";
import { redirect } from "next/navigation";
import { getDb } from "../../lib/cf-db";
import { endSession, startMemberSession } from "../../lib/session";

// Step 1 of sign-in: ask for a code. A registered email gets a code by email; an unregistered email gets nothing,
// but the answer looks the same, so nobody can use this form to find out who is registered.
export async function requestSignInCode(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = srmEmailSchema.safeParse(email);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter your SRM email." };
  }

  const db = await getDb();
  const member = await findMemberByEmail(db, parsed.data);

  if (!member) return { ok: true };

  const issued = await issueOtp(db, { email: parsed.data, purpose: "participant_sign_in" });

  if (!issued.ok) {
    if (issued.reason === "too_soon") {
      return {
        ok: false,
        message: `Wait ${issued.retryAfterSeconds} seconds before asking for another code.`,
      };
    }

    return { ok: false, message: "Too many codes today. Try again tomorrow." };
  }

  try {
    const sent = await sendEmail({
      to: parsed.data,
      template: "otp-code",
      props: { code: issued.code, purpose: "participant_sign_in" },
    });

    if (!sent.ok) return { ok: false, message: "We couldn't send the email. Try again in a minute." };
  } catch {
    return { ok: false, message: "We couldn't send the email. Try again in a minute." };
  }

  return { ok: true };
}

// Step 2: check the code. On success this signs the member in and redirects to /team, so it only ever returns a
// failure message.
export async function verifySignIn(email: string, code: string): Promise<{ ok: false; message: string }> {
  const parsedEmail = srmEmailSchema.safeParse(email);

  if (!parsedEmail.success) {
    return { ok: false, message: parsedEmail.error.issues[0]?.message ?? "Enter your SRM email." };
  }

  const parsedCode = otpCodeSchema.safeParse(code);

  if (!parsedCode.success) {
    return { ok: false, message: parsedCode.error.issues[0]?.message ?? "Enter the 6-digit code." };
  }

  const db = await getDb();
  const result = await verifyOtp(db, {
    email: parsedEmail.data,
    purpose: "participant_sign_in",
    code: parsedCode.data,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "invalid":
        return { ok: false, message: "That code isn't right." };
      case "expired":
        return { ok: false, message: "That code has expired. Ask for a new one." };
      case "too_many_attempts":
        return { ok: false, message: "Too many tries. Ask for a new code." };
      case "not_found":
        return { ok: false, message: "Ask for a code first." };
    }
  }

  const member = await findMemberByEmail(db, parsedEmail.data);

  if (!member) return { ok: false, message: "That code isn't right." };

  await startMemberSession(member.id);
  redirect("/team");
}

export async function signOut(): Promise<never> {
  await endSession();
  redirect("/");
}
