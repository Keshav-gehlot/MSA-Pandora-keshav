// Flow C, admin (Ujaan, Ritwik): this flow's email templates. Only this flow's owner edits this folder.
// Add a template: create <name>.tsx exporting { subject, text, html }, then add it to the object below.
import type { Template } from "../../types";
import { editDecided } from "./edit-decided";
import { paymentApproved } from "./payment-approved";
import { paymentDeclined } from "./payment-declined";

export const adminTemplates = {
  "admin-payment-approved": paymentApproved,
  "admin-payment-declined": paymentDeclined,
  "admin-edit-decided": editDecided,
} satisfies Record<string, Template<never>>;
