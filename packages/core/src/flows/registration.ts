// Flow A, registration (Harsh): browser-safe rules and schemas for this flow. Only this flow's owner edits this file.
// Plan: docs/superpowers/plans/2026-09-26-flow-registration.md
import { z } from "zod";
import { teamNameSchema, trackSchema } from "../rules";
import { UPLOADS } from "../config";

export const teamStepSchema = z.object({
  teamName: teamNameSchema,
  track: trackSchema,
});

export type UploadKind = "photo" | "paymentProof";

export function checkUpload(
  kind: UploadKind,
  file: { type: string; size: number },
): { ok: true } | { ok: false; message: string } {
  const upload = UPLOADS[kind];

  if (file.size === 0) {
    return { ok: false, message: "The file is empty" };
  }

  if (!(upload.types as readonly string[]).includes(file.type)) {
    const message =
      kind === "photo"
        ? "Use a JPEG, PNG or WebP image"
        : "Use a JPEG or PNG image";

    return { ok: false, message };
  }

  if (file.size > upload.maxBytes) {
    return { ok: false, message: "Files must be 5 MB or smaller" };
  }

  return { ok: true };
}

export function uploadExtension(type: string): "jpg" | "png" | "webp" {
  switch (type) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }

  throw new Error("Unsupported image type");
}

export function isPaymentEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
