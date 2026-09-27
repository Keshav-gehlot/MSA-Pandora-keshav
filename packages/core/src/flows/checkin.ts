// Flow D, check-in (Alrik): browser-safe rules and schemas for this flow. Only this flow's owner edits this file.
// Plan: docs/superpowers/plans/2026-09-26-flow-checkin.md

export const PASS_PREFIX = "pandora-pass:";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function formatPassPayload(token: string): string {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Invalid pass token: must be a 43-character base64url string");
  }
  return `${PASS_PREFIX}${token}`;
}

export function parsePassPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(PASS_PREFIX)) {
    return null;
  }
  const token = trimmed.slice(PASS_PREFIX.length);
  if (!TOKEN_PATTERN.test(token)) {
    return null;
  }
  return token;
}
