// Flow C, admin (Ujaan, Ritwik): browser-safe rules and schemas for this flow. Only this flow's owner edits this file.
// Plan: docs/superpowers/plans/2026-09-26-flow-admin.md
import { z } from "zod";

/** Zod schema for the send-notification form (title + body). */
export const notificationSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120, "Title must be at most 120 characters"),
  body: z.string().trim().min(1, "Body is required").max(2000, "Body must be at most 2000 characters"),
});

/** Zod schema for a submission review (score coerced from string, note trimmed). */
export const reviewSchema = z.object({
  score: z
    .union([
      z.string().trim().min(1, "Enter a score").transform((v) => Number(v)),
      z.number(),
    ])
    .pipe(
      z
        .number()
        .int("Score must be a whole number")
        .min(0, "Score must be at least 0")
        .max(100, "Score must be at most 100"),
    ),
  reviewNote: z.string().trim().max(1000, "Note must be at most 1000 characters"),
});

/** Zod schema for the short free-text note attached to a payment/edit decision. */
export const decisionNoteSchema = z.string().trim().max(500, "Note must be at most 500 characters");

const FORMULA_START_RE = /^[\s\p{Cc}]*[=+\-@]/u;
const NEEDS_QUOTING_RE = /[,"\r\n]/;

/**
 * Escapes a single CSV cell value following RFC 4180 with an extra defence
 * against spreadsheet formula injection.
 *
 * Rules applied in order:
 * 1. null / undefined → empty string.
 * 2. Non-string primitives (number, boolean) → stringify; no further escaping
 *    unless the result happens to trigger rules 3–4.
 * 3. Strings starting with =, +, -, @ → prepend a single quote (formula guard).
 * 4. Strings containing a comma, double-quote, or newline → wrap in double
 *    quotes and double any internal double-quotes (RFC 4180 §2.7).
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Formula-injection guard: prepend ' so spreadsheets treat it as text.
  if (typeof value == "string" && FORMULA_START_RE.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting: wrap and double internal quotes when special chars present.
  if (NEEDS_QUOTING_RE.test(str)) {
    str = `"${str.replaceAll('"', '""')}"`;
  }

  return str;
}

