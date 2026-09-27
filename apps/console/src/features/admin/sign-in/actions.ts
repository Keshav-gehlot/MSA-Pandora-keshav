"use server";

import { otpCodeSchema, personalEmailSchema } from "@pandora/core";
import { findStaffByEmail, getDb, issueOtp, verifyOtp } from "@pandora/db";
import { sendEmail } from "@pandora/email";
import { redirect } from "next/navigation";
import { endSession, startStaffSession } from "../../../lib/session";

export async function requestStaffCode(
  email: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = personalEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email" };
  }
  const normalizedEmail = parsed.data;
  const db = getDb();

  const staff = await findStaffByEmail(db, normalizedEmail);
  // Unknown emails receive the exact same neutral success response without sending an email,
  // preventing user enumeration.
  if (!staff) {
    return { ok: true };
  }

  const issued = await issueOtp(db, {
    email: normalizedEmail,
    purpose: "staff_sign_in",
  });

  if (!issued.ok) {
    if (issued.reason === "too_soon") {
      return {
        ok: false,
        message: `Please wait ${issued.retryAfterSeconds}s before requesting another code`,
      };
    }
    return {
      ok: false,
      message: "Daily sign-in code limit reached. Please try again tomorrow.",
    };
  }

  const sent = await sendEmail({
    to: normalizedEmail,
    template: "otp-code",
    props: { code: issued.code, purpose: "staff_sign_in" },
  });

  if (!sent.ok) {
    return {
      ok: false,
      message: "Could not send verification email. Please try again.",
    };
  }

  return { ok: true };
}

export async function verifyStaffSignIn(
  email: string,
  code: string,
): Promise<{ ok: false; message: string }> {
  const parsedEmail = personalEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { ok: false, message: "Enter a valid email" };
  }

  const parsedCode = otpCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return { ok: false, message: "Enter the 6-digit code" };
  }

  const normalizedEmail = parsedEmail.data;
  const db = getDb();

  const verified = await verifyOtp(db, {
    email: normalizedEmail,
    purpose: "staff_sign_in",
    code: parsedCode.data,
  });

  if (!verified.ok) {
    switch (verified.reason) {
      case "expired":
        return { ok: false, message: "Code has expired. Please request a new one." };
      case "too_many_attempts":
        return { ok: false, message: "Too many failed attempts. Please request a new code." };
      case "not_found":
        return { ok: false, message: "No active code found. Please request a code first." };
      case "invalid":
      default:
        return { ok: false, message: "Incorrect code. Please try again." };
    }
  }

  const staff = await findStaffByEmail(db, normalizedEmail);
  if (!staff) {
    return { ok: false, message: "Staff account not found" };
  }

  await startStaffSession(staff.id);
  redirect("/");
}

export async function staffSignOut(): Promise<never> {
  await endSession();
  redirect("/sign-in");
}
