import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { OTP, SESSION_DAYS } from "../config";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP.length).toString().padStart(OTP.length, "0");
}
export function hashOtp(email: string, code: string): string {
  return sha256(`${email}:${code}`);
}
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}
export function hashToken(token: string): string {
  return sha256(token);
}
const HEX_PATTERN = /^[0-9a-f]+$/i;

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  if (a.length === 0 || a.length % 2 !== 0) return false;
  if (!HEX_PATTERN.test(a) || !HEX_PATTERN.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export function otpExpiry(now: Date): Date {
  return new Date(now.getTime() + OTP.ttlMinutes * 60_000);
}
export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000);
}
