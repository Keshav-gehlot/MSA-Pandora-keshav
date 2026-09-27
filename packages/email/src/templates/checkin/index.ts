// Flow D, check-in (Alrik): this flow's email templates. Only this flow's owner edits this folder.
// Add a template: create <name>.tsx exporting { subject, text, html }, then add it to the object below.
import type { Template } from "../../types";
import { passReady } from "./pass-ready";

export const checkinTemplates = {
  "checkin-pass-ready": passReady,
} satisfies Record<string, Template<never>>;
