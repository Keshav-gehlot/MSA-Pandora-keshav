"use server";

import {
  checkUpload,
  isPaymentEnabled,
  otpCodeSchema,
  registrationSchema,
  srmEmailSchema,
  teamNameSchema,
  uploadExtension,
} from "@pandora/core";
import {
  findMemberByEmail,
  getDb,
  getStorage,
  isTeamNameAvailable,
  issueOtp,
  registerTeam,
  verifyOtp,
} from "@pandora/db";
import { sendEmail } from "@pandora/email";

type Result = { ok: true } | { ok: false; message: string };

export async function sendRegistrationCode(
  email: string,
): Promise<Result> {
  const parsedEmail = srmEmailSchema.safeParse(email);

  if (!parsedEmail.success) {
    return {
      ok: false,
      message: parsedEmail.error.issues[0]?.message ?? "Invalid SRM email",
    };
  }

  const db = getDb();

  const existingMember = await findMemberByEmail(db, parsedEmail.data);

  if (existingMember) {
    return {
      ok: false,
      message: "This email is already part of a registered team.",
    };
  }

  const issued = await issueOtp(db, {
    email: parsedEmail.data,
    purpose: "registration",
  });

  if (!issued.ok) {
    if (issued.reason === "too_soon") {
      return {
        ok: false,
        message: `Wait ${issued.retryAfterSeconds} seconds before asking for another code.`,
      };
    }

    return {
      ok: false,
      message: "Too many codes today. Try again tomorrow.",
    };
  }

  try {
    const sent = await sendEmail({
      to: parsedEmail.data,
      template: "otp-code",
      props: {
        code: issued.code,
        purpose: "registration",
      },
    });

    if (!sent.ok) {
      return {
        ok: false,
        message: "We couldn't send the email. Try again in a minute.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "We couldn't send the email. Try again in a minute.",
    };
  }

  return { ok: true };
}

export async function verifyRegistrationCode(
  email: string,
  code: string,
): Promise<Result> {
  const parsedEmail = srmEmailSchema.safeParse(email);

  if (!parsedEmail.success) {
    return {
      ok: false,
      message: parsedEmail.error.issues[0]?.message ?? "Invalid SRM email",
    };
  }

  const parsedCode = otpCodeSchema.safeParse(code);

  if (!parsedCode.success) {
    return {
      ok: false,
      message: parsedCode.error.issues[0]?.message ?? "Invalid code",
    };
  }

  const result = await verifyOtp(getDb(), {
    email: parsedEmail.data,
    purpose: "registration",
    code: parsedCode.data,
  });

  if (result.ok) {
    return { ok: true };
  }

  switch (result.reason) {
    case "invalid":
      return {
        ok: false,
        message: "That code isn't right.",
      };

    case "expired":
      return {
        ok: false,
        message: "That code has expired. Ask for a new one.",
      };

    case "too_many_attempts":
      return {
        ok: false,
        message: "Too many tries. Ask for a new code.",
      };

    case "not_found":
      return {
        ok: false,
        message: "Ask for a code first.",
      };
  }
}

export async function checkTeamName(
  name: string,
): Promise<{ available: boolean }> {
  const parsedName = teamNameSchema.safeParse(name);

  if (!parsedName.success) {
    return { available: false };
  }

  return {
    available: await isTeamNameAvailable(getDb(), parsedName.data),
  };
}

export async function submitRegistration(
  formData: FormData,
): Promise<
  | { ok: true; teamName: string }
  | {
      ok: false;
      message: string;
      field?: "teamName" | "regNumber" | "srmEmail";
    }
> {
  const registrationValue = formData.get("registration");

  if (typeof registrationValue !== "string") {
    return {
      ok: false,
      message: "Invalid registration details.",
    };
  }

  let rawRegistration: unknown;

  try {
    rawRegistration = JSON.parse(registrationValue);
  } catch {
    return {
      ok: false,
      message: "Invalid registration details.",
    };
  }

  const parsed = registrationSchema.safeParse(rawRegistration);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Invalid registration details.",
    };
  }

  const registration = parsed.data;
  const paymentEnabled = isPaymentEnabled(process.env.PAYMENT_ENABLED);
  const paymentProof = formData.get("paymentProof");

  if (
    paymentEnabled &&
    !(paymentProof instanceof File && paymentProof.size > 0)
  ) {
    return {
      ok: false,
      message: "Payment proof is required.",
    };
  }

  const teamId = crypto.randomUUID();
  const storage = getStorage();
  const photoPaths: Array<string | null> = [];

  for (let index = 0; index < registration.members.length; index += 1) {
    const file = formData.get(`photo-${index}`);

    if (!(file instanceof File)) {
      photoPaths.push(null);
      continue;
    }

    const checked = checkUpload("photo", {
      type: file.type,
      size: file.size,
    });

    if (!checked.ok) {
      return {
        ok: false,
        message: checked.message,
      };
    }

    const extension = uploadExtension(file.type);
    const path = `teams/${teamId}/photos/${index + 1}.${extension}`;

    await storage.putFile(
      path,
      new Uint8Array(await file.arrayBuffer()),
      file.type,
    );

    photoPaths.push(path);
  }

  let paymentProofPath: string | null = null;

  if (paymentProof instanceof File) {
    const checked = checkUpload("paymentProof", {
      type: paymentProof.type,
      size: paymentProof.size,
    });

    if (!checked.ok) {
      return {
        ok: false,
        message: checked.message,
      };
    }

    const extension = uploadExtension(paymentProof.type);
    paymentProofPath = `teams/${teamId}/payment/${crypto.randomUUID()}.${extension}`;

    await storage.putFile(
      paymentProofPath,
      new Uint8Array(await paymentProof.arrayBuffer()),
      paymentProof.type,
    );
  }

  const result = await registerTeam(getDb(), {
    teamId,
    registration,
    paymentEnabled,
    photoPaths,
    paymentProofPath,
  });

  if (!result.ok) {
    if (result.reason === "email_not_verified") {
      return {
        ok: false,
        message: "Verify the team leader's email first.",
      };
    }

    if (result.reason === "taken") {
      switch (result.field) {
        case "teamName":
          return {
            ok: false,
            message: "That team name is taken.",
            field: "teamName",
          };

        case "regNumber":
          return {
            ok: false,
            message:
              "One of these registration numbers is already registered.",
            field: "regNumber",
          };

        case "srmEmail":
          return {
            ok: false,
            message: "One of these SRM emails is already registered.",
            field: "srmEmail",
          };
      }
    }
  }

  await Promise.all(
    registration.members.map(async (member) => {
      try {
        await sendEmail({
          to: member.srmEmail,
          template: "registration-received",
          props: {
            teamName: registration.teamName,
            track: registration.track,
            memberNames: registration.members.map(
              (currentMember) =>
                `${currentMember.firstName} ${currentMember.lastName}`,
            ),
            paymentPending: paymentEnabled,
          },
        });
      } catch {
        // Registration succeeded; email failure must not undo it.
      }
    }),
  );

  return {
    ok: true,
    teamName: registration.teamName,
  };
}
