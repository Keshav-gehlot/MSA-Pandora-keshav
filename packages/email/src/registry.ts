import type { ReactElement } from "react";
import { otpCode } from "./templates/otp-code";

type Template<P> = { subject: (p: P) => string; text: (p: P) => string; html: (p: P) => ReactElement };

// Add a template: create templates/<name>.tsx exporting { subject, text, html }, then add one line here.
export const templates = {
  "otp-code": otpCode,
} satisfies Record<string, Template<never>>;

export type TemplateName = keyof typeof templates;
export type TemplateProps<T extends TemplateName> = Parameters<(typeof templates)[T]["subject"]>[0];
