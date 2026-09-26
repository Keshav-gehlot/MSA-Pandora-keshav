// Flow B, participant (Sasmita): this flow's email templates. Only this flow's owner edits this folder.
// Add a template: create <name>.tsx exporting { subject, text, html }, then add it to the object below.
import type { Template } from "../../types";

export const participantTemplates = {} satisfies Record<string, Template<never>>;
