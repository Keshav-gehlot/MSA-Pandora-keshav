import { otpCode } from "./templates/otp-code";
import { adminTemplates } from "./templates/admin";
import { checkinTemplates } from "./templates/checkin";
import { participantTemplates } from "./templates/participant";
import { registrationTemplates } from "./templates/registration";
import type { Template } from "./types";

// Shared templates live here; each flow adds its own in templates/<flow>/index.ts, so flows never edit this file.
export const templates = {
  "otp-code": otpCode,
  ...registrationTemplates,
  ...participantTemplates,
  ...adminTemplates,
  ...checkinTemplates,
} satisfies Record<string, Template<never>>;

export type TemplateName = keyof typeof templates;
export type TemplateProps<T extends TemplateName> = Parameters<(typeof templates)[T]["subject"]>[0];
