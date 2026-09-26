import { z } from "zod";
import { SRM_EMAIL_DOMAIN, TEAM_SIZE, TRACKS } from "./config";

export const personalEmailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
export const srmEmailSchema = personalEmailSchema.refine(
  (email) => email.endsWith(`@${SRM_EMAIL_DOMAIN}`),
  `Use your @${SRM_EMAIL_DOMAIN} email`,
);
export const regNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^RA\d{13}$/, "Registration numbers look like RA2611026010690");
export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^\+91/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"));
export const nameSchema = z.string().trim().min(1, "Required").max(50, "At most 50 characters");
export const teamNameSchema = z.string().trim().min(3, "At least 3 characters").max(40, "At most 40 characters");
export const trackSchema = z.enum(TRACKS, "Pick one of the tracks");
export const otpCodeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");

export const memberSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  regNumber: regNumberSchema,
  srmEmail: srmEmailSchema,
  personalEmail: personalEmailSchema,
  phone: phoneSchema,
});
export type MemberInput = z.input<typeof memberSchema>;
export type Member = z.output<typeof memberSchema>;

export const registrationSchema = z
  .object({
    teamName: teamNameSchema,
    track: trackSchema,
    members: z.array(memberSchema).min(TEAM_SIZE.min, `A team has at least ${TEAM_SIZE.min} members`).max(TEAM_SIZE.max, `A team has at most ${TEAM_SIZE.max} members`),
  })
  .superRefine((reg, ctx) => {
    const seen = { regNumber: new Set<string>(), srmEmail: new Set<string>() };
    reg.members.forEach((m, i) => {
      if (seen.regNumber.has(m.regNumber)) {
        ctx.addIssue({ code: "custom", path: ["members", i, "regNumber"], message: "Each member needs a different registration number" });
      }
      if (seen.srmEmail.has(m.srmEmail)) {
        ctx.addIssue({ code: "custom", path: ["members", i, "srmEmail"], message: "Each member needs a different SRM email" });
      }
      seen.regNumber.add(m.regNumber);
      seen.srmEmail.add(m.srmEmail);
    });
  });
export type RegistrationInput = z.input<typeof registrationSchema>;
export type Registration = z.output<typeof registrationSchema>;

export function teamNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
